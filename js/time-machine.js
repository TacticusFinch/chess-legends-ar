/* ==========================================================
   МАШИНА ВРЕМЕНИ — КВЕСТ-ПУТЕШЕСТВИЕ (21–22 ноября)
   Классический скрипт, без import/export. Сам создаёт свой DOM.

   Маршрут: I Пролог → II Дверь → III Испытания → IV Хранители → V Хранитель времени

   ДУЭЛИ: не своя механика, а настоящий NetDuel — тот же,
   что открывается по кнопке «Дуэль»: арена, карточки, HP,
   тактическая доска с задачей из duel-puzzles.js и таймером 30 с.
   Квест выбирает соперника и принимает итог.

   API:
     TimeMachineQuest.open(heroId)
     TimeMachineQuest.start(heroId)  — алиас
     TimeMachineQuest.close()

   Требуется NetDuel.startQuestDuel({playerId, enemyId, onEnd}).
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = {
    title: 'Машина времени',
    dates: '21–22 ноября',
    botName: 'TimeKeeperBot',
    botUrl: 'https://lichess.org/@/TimeKeeperBot',
    judgeCode: '2026',
    maxLives: 5,
    storagePrefix: 'chrono_quest_',
    greeting: {
      hello: 'Приветствую тебя, странник!',
      lead: 'Добро пожаловать на турнир «Машина времени»!',
      paragraphs: [
        'Ты только что оживил карточку чемпиона: AR-сканер считал мишень, хронометр турнира зафиксировал разлом — и карточка стала дверью в прошлое.',
        'Поэтому турнир и называется «Машина времени». Дверь открывается в эпоху чемпиона, и ты входишь туда гостем: он сам рассказывает о своей жизни и садится с тобой за доску.',
        'Впереди пять глав: пролог, дорога, испытания памяти, пять хранителей эпох и последний рубеж — Хранитель времени на Lichess. На весь путь даётся пять жизней: ошибка в факте или проигранная дуэль забирает одну.'
      ],
      question: 'Ты готов выйти в путь?'
    },
    jumpSteps: [
      'Калибровка хронометра турнира…',
      'Дверь открыта: {era}',
      'Чемпион {hero} выходит на связь…',
      'Архив закрыт на замок — ключи придётся собрать в пути.'
    ],
    // Маршрут: используется и в навигации, и в карте пути
    route: [
      { key: 'greet', num: 'I', title: 'Пролог', note: 'Разлом открыт. Чемпион ждёт гостя.' },
      { key: 'jump', num: 'II', title: 'Дорога', note: 'Переход в эпоху чемпиона.' },
      { key: 'quiz', num: 'III', title: 'Испытания', note: 'Пять фактов из жизни чемпиона.' },
      { key: 'duels', num: 'IV', title: 'Хранители', note: 'Пять рубежей, пять дуэлей.' },
      { key: 'final', num: 'V', title: 'Хранитель времени', note: 'Партия с ботом турнира.' }
    ]
  };

  var state = {
    hero: null,
    quest: null,
    stage: 'greet',
    quizIdx: 0,
    duelIdx: 0,
    lives: 0,
    nick: '',
    timeControl: '10+5',
    busy: false,
    inBattle: false,
    timers: [],
    shuffled: {}
  };

  var dom = null;
  var STAGE_ORDER = ['greet', 'jump', 'quiz', 'duels', 'final', 'victory'];

  /* ---------------- утилиты ---------------- */
  function play(name) {
    try {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') sfx[name]();
    } catch (e) {}
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      if (ch === '&') return '&amp;';
      if (ch === '<') return '&lt;';
      if (ch === '>') return '&gt;';
      if (ch === '"') return '&quot;';
      return '&#39;';
    });
  }

  function rand(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function after(ms, fn) {
    var id = setTimeout(function () {
      if (!isOpen()) return;
      fn();
    }, ms);
    state.timers.push(id);
    return id;
  }

  function clearTimers() {
    state.timers.forEach(function (id) { clearTimeout(id); });
    state.timers = [];
  }

  function isOpen() {
    return !!dom && dom.overlay.classList.contains('tm-modal-active');
  }

  function routeItem(key) {
    for (var i = 0; i < CONFIG.route.length; i++) {
      if (CONFIG.route[i].key === key) return CONFIG.route[i];
    }
    return null;
  }

  function storageKey() {
    return CONFIG.storagePrefix + (state.quest ? state.quest.id : 'unknown');
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        lives: state.lives,
        quizIdx: state.quizIdx,
        duelIdx: state.duelIdx,
        disqualified: state.lives <= 0,
        heroId: state.quest ? state.quest.id : null,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  function heroNumericId(hero) {
    if (!hero || typeof HERO_STATS_DATA === 'undefined') return null;
    var keys = Object.keys(HERO_STATS_DATA);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (HEROES && HEROES[key] && HEROES[key].id === hero.id) return Number(key);
      if (String(key) === String(hero.id)) return Number(key);
    }
    return null;
  }

  /* ---------------- данные ---------------- */
  function buildDuels(hero) {
    var stats = (typeof HERO_STATS_DATA !== 'undefined' && HERO_STATS_DATA) ? HERO_STATS_DATA : null;
    var ranks = (typeof HERO_RANKS !== 'undefined' && HERO_RANKS) ? HERO_RANKS : null;
    var heroes = (typeof HEROES !== 'undefined' && HEROES) ? HEROES : null;
    var list = [];

    if (stats && heroes) {
      var pool = Object.keys(stats)
        .map(function (k) { return Number(k); })
        .filter(function (id) { return !isNaN(id) && heroes[id] && heroes[id].id !== hero.id; })
        .sort(function (a, b) { return (stats[a].atk || 0) - (stats[b].atk || 0); });

      var picked = [];
      for (var i = 0; i < 5 && pool.length; i++) {
        var pos = Math.round((i / 4) * (pool.length - 1));
        var candidate = pool[pos];
        if (picked.indexOf(candidate) !== -1) {
          for (var j = 0; j < pool.length; j++) {
            if (picked.indexOf(pool[j]) === -1) { candidate = pool[j]; break; }
          }
        }
        if (candidate === undefined || picked.indexOf(candidate) !== -1) break;
        picked.push(candidate);
      }

      picked.forEach(function (id, idx) {
        var h = heroes[id];
        var s = stats[id] || {};
        var rankName = (ranks && s.rank && ranks[s.rank]) ? ranks[s.rank].name : 'ЛЕГЕНДА';
        list.push({
          enemyId: id,
          opponentName: h.name,
          opponentTitle: 'Хранитель ' + (idx + 1) + '-го рубежа',
          opponentRank: rankName,
          avatar: h.avatar || '',
          skillName: s.skillName || 'Коронный ход',
          introQuote: h.quote || ''
        });
      });
    }

    if (!list.length) {
      for (var k = 0; k < 5; k++) {
        list.push({
          enemyId: k,
          opponentName: 'Хранитель ' + (k + 1) + '-го рубежа',
          opponentTitle: 'Испытание ' + (k + 1),
          opponentRank: 'ЛЕГЕНДА',
          avatar: '',
          skillName: 'Точный расчёт',
          introQuote: ''
        });
      }
    }

    return list;
  }

  function buildQuiz(hero) {
    var quest = hero.quest || {};
    var list = [];

    if (quest.bioQuiz && quest.bioQuiz.length) {
      quest.bioQuiz.forEach(function (item) {
        list.push({
          q: item.q || item.question || '',
          options: (item.options || []).map(function (o) {
            return { text: o.text, correct: !!o.correct, comment: o.comment || '' };
          })
        });
      });
      return list;
    }

    if (hero.puzzles && hero.puzzles.length) {
      hero.puzzles.forEach(function (p) {
        list.push({
          q: p.desc || 'Вопрос о чемпионе',
          options: (p.options || []).map(function (o) {
            return { text: o.text, correct: !!o.correct, comment: o.comment || '' };
          })
        });
      });
    }

    return list;
  }

  function resolveQuest(heroId) {
    var heroes = (typeof HEROES !== 'undefined' && HEROES) ? HEROES : null;
    if (!heroes) return null;

    var hero = heroes[heroId] || heroes[String(heroId)];
    if (!hero) return null;

    var quest = hero.quest || {};
    var quiz = buildQuiz(hero);
    if (!quiz.length) return null;

    return {
      id: hero.id || heroId,
      name: hero.name || 'Чемпион',
      shortName: (hero.name || 'Чемпион').split(' ').pop(),
      piece: quest.piece || '♚',
      era: quest.era || hero.title || 'эпоха чемпиона',
      title: hero.title || '',
      mission: quest.mission || 'Пройти пять глав пути, восстановить память чемпиона и выстоять в партии с Хранителем времени.',
      quiz: quiz,
      duels: (quest.duels && quest.duels.length) ? quest.duels : buildDuels(hero)
    };
  }

  /* ---------------- DOM ---------------- */
  function ensureDOM() {
    if (dom) return dom;

    var overlay = document.createElement('div');
    overlay.className = 'tm-overlay';
    overlay.id = 'tm-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = [
      '<div class="tm-quantum-card" role="dialog" aria-modal="true" aria-label="Квест Машина времени">',
      '  <header class="tm-head">',
      '    <div class="tm-head-info">',
      '      <div class="tm-epoch" id="tm-epoch">—</div>',
      '      <div class="tm-lives-row">',
      '        <span class="tm-lives-label">жизни</span>',
      '        <div class="tm-lives" id="tm-lives"></div>',
      '      </div>',
      '    </div>',
      '    <div class="tm-compass" aria-hidden="true"><i></i></div>',
      '    <button class="tm-close" type="button" id="tm-close" aria-label="Закрыть квест">✕</button>',
      '  </header>',
      '  <nav class="tm-pips" aria-label="Главы пути">',
      CONFIG.route.map(function (item) {
        return '    <span class="tm-pip" data-pip="' + item.key + '">' + item.num + ' · ' + esc(item.title) + '</span>';
      }).join(''),
      '  </nav>',
      '  <div class="tm-body" id="tm-body"></div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      body: overlay.querySelector('#tm-body'),
      lives: overlay.querySelector('#tm-lives'),
      epoch: overlay.querySelector('#tm-epoch'),
      closeBtn: overlay.querySelector('#tm-close'),
      pips: {}
    };

    Array.prototype.forEach.call(overlay.querySelectorAll('.tm-pip'), function (node) {
      dom.pips[node.getAttribute('data-pip')] = node;
    });

    dom.closeBtn.addEventListener('click', function () { close(); });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });

    return dom;
  }

  /* ---------------- общее ---------------- */
  function setPips(stage) {
    state.stage = stage;
    var current = STAGE_ORDER.indexOf(stage);
    Object.keys(dom.pips).forEach(function (key) {
      var node = dom.pips[key];
      var idx = STAGE_ORDER.indexOf(key);
      node.classList.toggle('is-active', idx === current);
      node.classList.toggle('is-done', idx < current);
    });
  }

  function renderLives(shake) {
    if (!dom.lives) return;
    dom.lives.innerHTML = '';
    for (var i = 1; i <= CONFIG.maxLives; i++) {
      var span = document.createElement('span');
      span.className = 'tm-heart' + (i <= state.lives ? '' : ' is-lost');
      span.textContent = i <= state.lives ? '♥' : '♡';
      dom.lives.appendChild(span);
    }
    if (shake) {
      dom.lives.classList.remove('is-broken');
      void dom.lives.offsetWidth;
      dom.lives.classList.add('is-broken');
      dom.body.classList.remove('is-shaking');
      void dom.body.offsetWidth;
      dom.body.classList.add('is-shaking');
    }
  }

  function loseLife(reason) {
    state.lives = Math.max(0, state.lives - 1);
    saveProgress();
    play('playWrong');
    renderLives(true);

    if (state.lives <= 0) {
      after(650, function () { renderGameOver(reason); });
      return false;
    }
    return true;
  }

  /* заголовок главы */
  function chapterHead(stageKey, noteOverride) {
    var item = routeItem(stageKey);
    if (!item) return '';
    return [
      '<div class="tm-chapter">',
      '  <div class="tm-chapter-num">' + item.num + '</div>',
      '  <div class="tm-chapter-body">',
      '    <div class="tm-chapter-title">' + esc(item.title) + '</div>',
      '    <div class="tm-chapter-note">' + esc(noteOverride || item.note) + '</div>',
      '  </div>',
      '</div>'
    ].join('\n');
  }

  /* карта пути */
  function routeMap(currentKey) {
    var currentIdx = STAGE_ORDER.indexOf(currentKey);
    return [
      '<div class="tm-route">',
      CONFIG.route.map(function (item) {
        var idx = STAGE_ORDER.indexOf(item.key);
        var cls = idx < currentIdx ? 'is-done' : (idx === currentIdx ? 'is-current' : '');
        var status = idx < currentIdx ? 'пройдено' : (idx === currentIdx ? 'вы здесь' : 'впереди');
        return [
          '  <div class="tm-route-stop ' + cls + '">',
          '    <div class="tm-route-node"></div>',
          '    <div class="tm-route-body">',
          '      <div class="tm-route-name">' + item.num + '. ' + esc(item.title) + '</div>',
          '      <div class="tm-route-note">' + esc(item.note) + '</div>',
          '      <div class="tm-route-status">' + status + '</div>',
          '    </div>',
          '  </div>'
        ].join('\n');
      }).join(''),
      '</div>'
    ].join('\n');
  }

  /* ---------------- I. ПРОЛОГ ---------------- */
  function renderGreeting() {
    setPips('greet');
    renderLives(false);
    var quest = state.quest;
    var hero = state.hero || {};
    var g = CONFIG.greeting;
    var rankName = (hero.rank && hero.rank.name) ? hero.rank.name : 'ЛЕГЕНДА';
    var portrait = hero.avatar
      ? '<img src="' + esc(hero.avatar) + '" alt="' + esc(quest.name) + '" onerror="this.style.display=\'none\'">'
      : '<span>' + esc(quest.piece) + '</span>';

    dom.body.innerHTML = [
      chapterHead('greet', 'Разлом открыт · ' + quest.era),
      '<div class="tm-greet">',
      '  <div class="tm-hero-banner">',
      '    <div class="tm-hero-portrait">' + portrait + '</div>',
      '    <div class="tm-hero-meta">',
      '      <div class="tm-hero-name">' + esc(quest.name) + '</div>',
      '      <div class="tm-rank-chip">' + esc(rankName) + '</div>',
      '      <div class="tm-hero-era">' + esc(quest.era) + '</div>',
      '    </div>',
      '  </div>',
      '  <div class="tm-stats">',
      '    <div class="tm-stat"><div class="tm-stat-label">Главы</div><div class="tm-stat-value">5 <small>этапов</small></div></div>',
      '    <div class="tm-stat"><div class="tm-stat-label">Вопросы</div><div class="tm-stat-value">' + quest.quiz.length + ' <small>фактов</small></div></div>',
      '    <div class="tm-stat"><div class="tm-stat-label">Жизни</div><div class="tm-stat-value">' + CONFIG.maxLives + ' <small>попыток</small></div></div>',
      '  </div>',
      '  <div>',
      '    <div class="tm-greet-hello">' + esc(g.hello) + '</div>',
      '    <div class="tm-greet-lead">' + esc(g.lead) + '</div>',
      '  </div>',
      '  <div class="tm-story">',
      g.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(''),
      '  </div>',
      '  <div class="tm-rules">',
      '    <div class="tm-rules-title">Маршрут</div>',
      routeMap('greet'),
      '  </div>',
      '  <div class="tm-greet-question">' + esc(g.question) + '</div>',
      '  <div class="tm-actions-row">',
      '    <button class="tm-btn tm-btn-ghost" type="button" id="tm-bio-btn">Биография</button>',
      '    <button class="tm-btn" type="button" id="tm-ready-btn">Выйти в путь</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    dom.body.querySelector('#tm-bio-btn').addEventListener('click', renderBioViewer);
    dom.body.querySelector('#tm-ready-btn').addEventListener('click', function () {
      play('playUltimate');
      renderJump();
    });
  }

  function renderBioViewer() {
    var hero = state.hero;
    var bio = (hero && hero.bio) ? hero.bio : [];

    dom.body.innerHTML = [
      '<div class="tm-stage-head">',
      '  <span class="tm-badge tm-badge-gold">Хроники · ' + esc(state.quest.name) + '</span>',
      '  <button class="tm-btn tm-btn-ghost tm-btn-sm" type="button" id="tm-bio-back">Назад</button>',
      '</div>',
      '<div class="tm-story">',
      bio.map(function (s) {
        return '<p><strong style="color: var(--accent-gold); font-weight: 600;">' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>';
      }).join(''),
      '</div>',
      '<button class="tm-btn" type="button" id="tm-bio-next">В путь</button>'
    ].join('\n');

    dom.body.querySelector('#tm-bio-back').addEventListener('click', renderGreeting);
    dom.body.querySelector('#tm-bio-next').addEventListener('click', function () {
      play('playUltimate');
      renderJump();
    });
  }

  /* ---------------- II. ДОРОГА ---------------- */
  function renderJump() {
    setPips('jump');
    var quest = state.quest;
    var steps = CONFIG.jumpSteps.map(function (line) {
      return line.replace('{hero}', quest.name).replace('{era}', quest.era);
    });

    dom.body.innerHTML = [
      chapterHead('jump', 'Переход · ' + quest.era),
      '<div class="tm-jump">',
      '  <div class="jump-stage">',
      '    <div class="jump-ring r1"></div>',
      '    <div class="jump-ring r2"></div>',
      '    <div class="jump-ring r3"></div>',
      '    <div class="jump-core"></div>',
      '  </div>',
      '  <div>',
      '    <div class="tm-title">Дверь открыта</div>',
      '    <div class="tm-sub">' + esc(quest.era) + '</div>',
      '  </div>',
      '  <div class="jump-steps" id="tm-jump-steps">',
      steps.map(function (line, i) {
        return '<div class="jump-step" data-step="' + i + '"><span class="mark">›</span><span>' + esc(line) + '</span></div>';
      }).join(''),
      '  </div>',
      '  <button class="tm-btn" type="button" id="tm-jump-next" hidden>Дальше по пути</button>',
      '</div>'
    ].join('\n');

    var nodes = dom.body.querySelectorAll('.jump-step');
    var next = dom.body.querySelector('#tm-jump-next');

    Array.prototype.forEach.call(nodes, function (node, i) {
      after(340 + i * 820, function () {
        node.classList.add('is-on');
        play('playMove');
      });
    });

    after(340 + nodes.length * 820, function () {
      next.hidden = false;
    });

    next.addEventListener('click', renderChallenge);
  }

  /* брифинг */
  function renderChallenge() {
    setPips('jump');
    var quizCount = state.quest.quiz.length;
    var duelCount = state.quest.duels.length;

    var cards = [
      { icon: '01', title: quizCount + ' вопросов о жизни чемпиона', text: 'Факты из его биографии. Ошибка стоит одной жизни, а вопрос остаётся — его можно переиграть.' },
      { icon: '02', title: duelCount + ' дуэлей с хранителями эпох', text: 'Каждая дуэль — как обычная: арена, карточки, тактическая доска и 30 секунд на ход. Решил задачу — нанёс урон, не решил — получил удар.' },
      { icon: '03', title: 'Вызов Хранителю времени', text: 'Партия с ботом турнира на Lichess. Покажите ник и код судье: первые трое финалистов получают суперприз.' }
    ];

    dom.body.innerHTML = [
      '<div class="tm-stage-head">',
      '  <span class="tm-badge tm-badge-gold">Снаряжение</span>',
      '  <span class="tm-counter">' + CONFIG.maxLives + ' жизней</span>',
      '</div>',
      '<div class="tm-title">Что взять в дорогу</div>',
      '<div class="challenge-list">',
      cards.map(function (c) {
        return [
          '  <div class="challenge-item">',
          '    <div class="challenge-icon">' + c.icon + '</div>',
          '    <div>',
          '      <div class="challenge-title">' + esc(c.title) + '</div>',
          '      <div class="challenge-text">' + esc(c.text) + '</div>',
          '    </div>',
          '  </div>'
        ].join('\n');
      }).join(''),
      '</div>',
      '<button class="tm-btn" type="button" id="tm-challenge-next">К испытаниям</button>'
    ].join('\n');

    dom.body.querySelector('#tm-challenge-next').addEventListener('click', function () {
      play('playUltimate');
      state.quizIdx = 0;
      renderQuiz();
    });
  }

  /* ---------------- III. ИСПЫТАНИЯ ---------------- */
  function renderQuiz() {
    setPips('quiz');
    var quiz = state.quest.quiz;
    var total = quiz.length;
    var idxAtRender = state.quizIdx;
    var item = quiz[state.quizIdx];

    if (!state.shuffled[state.quizIdx]) {
      state.shuffled[state.quizIdx] = item.options
        .map(function (o) { return o; })
        .sort(function () { return Math.random() - 0.5; });
    }
    var options = state.shuffled[state.quizIdx];

    dom.body.innerHTML = [
      chapterHead('quiz', 'Факт ' + (state.quizIdx + 1) + ' из ' + total),
      '<div class="tm-question">' + esc(item.q) + '</div>',
      '<div class="tm-options" id="tm-opts"></div>',
      '<div class="tm-feedback" id="tm-fb" hidden></div>',
      '<div class="tm-footer">',
      '  <div class="tm-warn">Ошибка −1 ♥</div>',
      '  <button class="tm-btn tm-btn-sm" type="button" id="tm-quiz-next" hidden>' +
        (state.quizIdx < total - 1 ? 'Дальше' : 'К хранителям') + '</button>',
      '</div>'
    ].join('\n');

    var opts = dom.body.querySelector('#tm-opts');
    var fb = dom.body.querySelector('#tm-fb');
    var next = dom.body.querySelector('#tm-quiz-next');

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tm-opt';
      btn.textContent = opt.text;

      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        Array.prototype.forEach.call(opts.children, function (child) {
          child.disabled = true;
          child.classList.add('is-dim');
        });
        fb.hidden = false;

        if (opt.correct) {
          play('playCorrect');
          btn.classList.remove('is-dim');
          btn.classList.add('is-correct');
          fb.className = 'tm-feedback is-ok';
          fb.innerHTML = '<b>Верно.</b> ' + esc(opt.comment);
          next.hidden = false;
          return;
        }

        btn.classList.remove('is-dim');
        btn.classList.add('is-wrong');
        var alive = loseLife('Ошибка в факте биографии чемпиона');
        fb.className = 'tm-feedback is-bad';

        if (!alive) {
          fb.innerHTML = '<b>Жизни закончились.</b>';
          return;
        }

        fb.innerHTML = '<b>Неверно.</b> Потеряна 1 жизнь (осталось ' + state.lives +
          ' из ' + CONFIG.maxLives + ').<br>' + esc(opt.comment) +
          '<br><span class="tm-hintline">Попробуйте снова.</span>';

        after(1900, function () {
          if (state.stage !== 'quiz' || state.quizIdx !== idxAtRender) return;
          var optsNow = dom.body.querySelector('#tm-opts');
          if (!optsNow) return;
          Array.prototype.forEach.call(optsNow.children, function (child) {
            child.disabled = false;
            child.classList.remove('is-dim', 'is-wrong');
          });
          var fbNow = dom.body.querySelector('#tm-fb');
          if (fbNow) fbNow.hidden = true;
        });
      });

      opts.appendChild(btn);
    });

    next.addEventListener('click', function () {
      if (state.quizIdx < total - 1) {
        state.quizIdx++;
        saveProgress();
        renderQuiz();
      } else {
        play('playUltimate');
        state.duelIdx = 0;
        renderDuel();
      }
    });
  }

  /* ---------------- IV. ХРАНИТЕЛИ ---------------- */
  function renderDuel() {
    setPips('duels');
    var duels = state.quest.duels;
    var total = duels.length;
    var duel = duels[state.duelIdx];

    state.busy = false;

    var dots = duels.map(function (_, i) {
      var cls = i < state.duelIdx ? 'is-done' : (i === state.duelIdx ? 'is-current' : '');
      return '<span class="duel-dot ' + cls + '"></span>';
    }).join('');

    var avatar = duel.avatar
      ? '<img src="' + esc(duel.avatar) + '" alt="' + esc(duel.opponentName) + '" onerror="this.style.display=\'none\'">'
      : esc(String(duel.opponentRank || '♚').charAt(0));

    dom.body.innerHTML = [
      chapterHead('duels', 'Рубеж ' + (state.duelIdx + 1) + ' из ' + total),
      '<div class="tm-duel">',
      '  <div class="tm-stage-head">',
      '    <span class="tm-badge tm-badge-red">Хранитель рубежа</span>',
      '    <span class="duel-dots">' + dots + '</span>',
      '  </div>',
      '  <div class="tm-opponent">',
      '    <div class="tm-opp-avatar">' + avatar + '</div>',
      '    <div>',
      '      <div class="tm-opp-name">' + esc(duel.opponentName) + '</div>',
      '      <div class="tm-opp-title">' + esc(duel.opponentTitle || '') +
        (duel.opponentRank ? ' · ' + esc(duel.opponentRank) : '') + '</div>',
      duel.introQuote ? '      <div class="tm-quote">' + esc(duel.introQuote) + '</div>' : '',
      '    </div>',
      '  </div>',
      '  <div class="tm-rules">',
      '    <div class="tm-rules-title">Как проходит бой</div>',
      '    Арена с карточками, 50 HP, заряд приёма. Атака, защита и коронный приём открывают тактическую доску:',
      '    задача из базы проекта и 30 секунд на ход. Решил — нанёс урон, не решил — удар получаешь ты.',
      '  </div>',
      '  <div class="tm-log" id="tm-duel-log">Соперник готов. Дуэль идёт на арене, как в обычном режиме.</div>',
      '  <div class="tm-actions-row">',
      '    <button class="tm-btn" type="button" id="tm-duel-start">Выйти на арену</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    dom.body.querySelector('#tm-duel-start').addEventListener('click', startQuestDuel);
  }

  function startQuestDuel() {
    if (state.busy || state.inBattle) return;

    if (typeof NetDuel === 'undefined' || typeof NetDuel.startQuestDuel !== 'function') {
      var log = dom.body.querySelector('#tm-duel-log');
      if (log) log.textContent = 'NetDuel не найден: подключите js/net-duel.js и патч startQuestDuel.';
      console.warn('[TimeMachineQuest] нужен NetDuel.startQuestDuel()');
      return;
    }

    var duel = state.quest.duels[state.duelIdx];
    state.busy = true;
    state.inBattle = true;

    var btn = dom.body.querySelector('#tm-duel-start');
    if (btn) btn.disabled = true;

    hideQuestForBattle();

    var started = NetDuel.startQuestDuel({
      // [FIX] Герой игрока — строго из карточки квеста, а не из кэша NetDuel
      playerId: state.quest.id,
      enemyId: duel.enemyId,
      onEnd: function (outcome) {
        state.inBattle = false;
        state.busy = false;
        restoreQuestAfterBattle();
        handleDuelResult(outcome);
      }
    });

    if (!started) {
      state.inBattle = false;
      state.busy = false;
      restoreQuestAfterBattle();
      if (btn) btn.disabled = false;
      var log = dom.body.querySelector('#tm-duel-log');
      if (log) log.textContent = 'Не удалось начать дуэль: наведите камеру на карточку чемпиона.';
    }
  }

  function hideQuestForBattle() {
    if (!dom) return;
    dom.overlay.classList.remove('tm-modal-active');
    dom.overlay.setAttribute('aria-hidden', 'true');
  }

  function restoreQuestAfterBattle() {
    if (!dom) return;
    dom.overlay.classList.add('tm-modal-active');
    dom.overlay.setAttribute('aria-hidden', 'false');
  }

  function handleDuelResult(outcome) {
    var duel = state.quest.duels[state.duelIdx];
    var log = dom.body.querySelector('#tm-duel-log');
    var btn = dom.body.querySelector('#tm-duel-start');

    if (outcome === 'win' || outcome === true) {
      if (log) log.textContent = 'Рубеж взят.';
      play('playCorrect');
      after(900, function () {
        if (state.stage !== 'duels') return;
        if (state.duelIdx < state.quest.duels.length - 1) {
          state.duelIdx++;
          saveProgress();
          renderDuel();
        } else {
          renderFinal();
        }
      });
      return;
    }

    var alive = loseLife('Поражение в дуэли против ' + duel.opponentName);
    if (log) {
      log.textContent = outcome === 'draw'
        ? 'Ничья. По правилам турнира рубеж не зачтён.'
        : 'Поражение. Рубеж не зачтён.';
    }
    if (alive && btn) {
      btn.disabled = false;
      btn.textContent = 'Повторить дуэль';
    }
  }

  /* ---------------- V. ХРАНИТЕЛЬ ВРЕМЕНИ ---------------- */
  function renderFinal() {
    setPips('final');

    dom.body.innerHTML = [
      chapterHead('final', 'Последний рубеж'),
      '<div class="tm-final">',
      '  <div class="tm-final-icon">ХРАНИТЕЛЬ</div>',
      '  <div>',
      '    <div class="tm-title">Вызов Хранителю времени</div>',
      '    <div class="tm-sub">Партия с ботом турнира на Lichess</div>',
      '  </div>',
      '  <div class="tm-story tm-story-compact">',
      '    <p>' + esc(state.quest.name) + ' прошёл память чемпиона и пять хранителей эпох. Остался последний рубеж.</p>',
      '    <p class="tm-mission">Первые три участника, завершившие партию с ботом и показавшие сертификат судье, получают суперприз турнира.</p>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 1 · профиль бота</div>',
      '    <a class="tm-btn tm-btn-cyan" href="' + esc(CONFIG.botUrl) + '" target="_blank" rel="noopener">@' +
        esc(CONFIG.botName) + ' на Lichess</a>',
      '    <div class="challenge-text">На странице бота нажмите «Вызвать на партию» и выберите контроль времени.</div>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 2 · параметры партии</div>',
      '    <label class="tm-field-label" for="tm-tc">Контроль времени</label>',
      '    <select class="tm-select" id="tm-tc">',
      '      <option value="5+3">5 + 3 · блиц</option>',
      '      <option value="10+5" selected>10 + 5 · рапид</option>',
      '      <option value="15+10">15 + 10 · классика</option>',
      '    </select>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 3 · результат</div>',
      '    <input class="tm-input" type="text" id="tm-nick" placeholder="Ваш ник на Lichess" autocomplete="off">',
      '    <div class="tm-err" id="tm-nick-err" hidden>Введите ник (минимум 3 символа) — судьям нужно зафиксировать результат.</div>',
      '    <button class="tm-btn" type="button" id="tm-verify">Подтвердить и получить грамоту</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    var input = dom.body.querySelector('#tm-nick');
    var err = dom.body.querySelector('#tm-nick-err');
    var select = dom.body.querySelector('#tm-tc');

    function verify() {
      var value = input.value.trim();
      if (value.length < 3) {
        err.hidden = false;
        input.focus();
        return;
      }
      err.hidden = true;
      state.nick = value;
      state.timeControl = select.value;
      renderVictory();
    }

    dom.body.querySelector('#tm-verify').addEventListener('click', verify);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') verify();
    });
  }

  /* ---------------- ГРАМОТА ---------------- */
  function renderVictory() {
    setPips('victory');
    play('playFanfare');

    var quest = state.quest;
    var time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var code = 'QT-' + rand(1000, 9999) + '-' + String(quest.id).toUpperCase().slice(0, 3);

    var certificate = [
      'ГРАМОТА ФИНАЛИСТА ТУРНИРА «МАШИНА ВРЕМЕНИ»',
      'Чемпион: ' + quest.name,
      'Игрок: ' + state.nick,
      'Партия с ботом: ' + CONFIG.botName + ', контроль ' + state.timeControl,
      'Время финиша: ' + time,
      'Код верификации: ' + code,
      'Остаток жизней: ' + state.lives + ' из ' + CONFIG.maxLives,
      'Даты турнира: ' + CONFIG.dates
    ].join('\n');

    dom.body.innerHTML = [
      '<div class="tm-victory">',
      '  <div class="tm-crown">ПУТЬ ПРОЙДЕН</div>',
      '  <div>',
      '    <div class="tm-title">' + esc(quest.name) + ' пройден</div>',
      '    <div class="tm-sub">Пять глав, пять рубежей и партия с Хранителем</div>',
      '  </div>',
      '  <div class="tm-seal">',
      '    <div class="tm-seal-title">Грамота финалиста · топ-3</div>',
      '    <div class="tm-seal-champ">' + esc(quest.name) + '</div>',
      '    <div class="tm-seal-line">Игрок: ' + esc(state.nick) + '<br>Контроль: ' + esc(state.timeControl) + '</div>',
      '    <div class="tm-seal-code">' + code + '</div>',
      '    <div class="tm-seal-sub">Финиш ' + time + ' · жизни ' + state.lives + '/' + CONFIG.maxLives +
        ' · ' + esc(CONFIG.dates) + '</div>',
      '  </div>',
      '  <div class="tm-rules">',
      '    <div class="tm-rules-title">Покажите этот экран судье</div>',
      '    Первые трое участников с верификационным кодом получают суперприз турнира.',
      '  </div>',
      '  <button class="tm-btn tm-btn-ghost" type="button" id="tm-download">Скачать грамоту</button>',
      '  <button class="tm-btn" type="button" id="tm-finish">Вернуться к карточке</button>',
      '</div>'
    ].join('\n');

    dom.body.querySelector('#tm-download').addEventListener('click', function () {
      var blob = new Blob([certificate], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'gramota-' + quest.id + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    dom.body.querySelector('#tm-finish').addEventListener('click', function () {
      var numericId = heroNumericId(state.hero);
      if (numericId !== null) {
        if (typeof registerCardDiscovery === 'function') registerCardDiscovery(numericId);
        if (typeof registerTestPassed === 'function') registerTestPassed(numericId);
      }
      close();
    });
  }

  /* ---------------- ВЫБЫВАНИЕ ---------------- */
  function renderGameOver(reason) {
    state.stage = 'gameover';
    Object.keys(dom.pips).forEach(function (key) {
      dom.pips[key].classList.remove('is-active');
    });
    play('playDamageTaken');

    dom.body.innerHTML = [
      '<div class="tm-gameover">',
      '  <div class="tm-go-icon">ПУТЬ ПРЕРВАН</div>',
      '  <div>',
      '    <div class="tm-title tm-title-red">Выбывание из конкурса</div>',
      '    <div class="tm-sub">Жизни закончились · 0 из ' + CONFIG.maxLives + '</div>',
      '  </div>',
      '  <div class="tm-go-reason"><b>Причина:</b> ' + esc(reason) + '</div>',
      '  <div class="tm-go-note">Прохождение этой карточки в турнирном режиме остановлено. Биография и свободные дуэли остаются доступны. Пересдачу открывает судья мастер-кодом.</div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Мастер-код судьи</div>',
      '    <input class="tm-input" type="password" id="tm-pin" placeholder="Код" autocomplete="off">',
      '    <div class="tm-err" id="tm-pin-err" hidden>Неверный код. Обратитесь к организаторам турнира.</div>',
      '    <button class="tm-btn" type="button" id="tm-judge">Судейский сброс</button>',
      '  </div>',
      '  <button class="tm-btn tm-btn-ghost" type="button" id="tm-close-go">Закрыть</button>',
      '</div>'
    ].join('\n');

    var pin = dom.body.querySelector('#tm-pin');
    var err = dom.body.querySelector('#tm-pin-err');

    dom.body.querySelector('#tm-judge').addEventListener('click', function () {
      if (pin.value.trim() !== CONFIG.judgeCode) {
        err.hidden = false;
        pin.focus();
        return;
      }
      err.hidden = true;
      try { localStorage.removeItem(storageKey()); } catch (e) {}
      state.lives = CONFIG.maxLives;
      state.quizIdx = 0;
      state.duelIdx = 0;
      state.shuffled = {};
      play('playUltimate');
      renderGreeting();
    });

    dom.body.querySelector('#tm-close-go').addEventListener('click', close);
  }

  /* ---------------- API ---------------- */
  function open(heroId) {
    ensureDOM();

    var quest = resolveQuest(heroId);
    if (!quest) {
      console.warn('[TimeMachineQuest] для карточки нет данных квеста:', heroId);
      return false;
    }

    state.hero = (typeof HEROES !== 'undefined' && HEROES) ? (HEROES[heroId] || HEROES[String(heroId)]) : null;
    state.quest = quest;
    state.stage = 'greet';
    state.quizIdx = 0;
    state.duelIdx = 0;
    state.lives = CONFIG.maxLives;
    state.nick = '';
    state.timeControl = '10+5';
    state.busy = false;
    state.inBattle = false;
    state.shuffled = {};
    clearTimers();

    var saved = loadProgress();
    if (saved) {
      if (typeof saved.lives === 'number' && saved.lives >= 0) state.lives = saved.lives;
      if (typeof saved.quizIdx === 'number') state.quizIdx = Math.min(saved.quizIdx, quest.quiz.length - 1);
      if (typeof saved.duelIdx === 'number') state.duelIdx = Math.min(saved.duelIdx, quest.duels.length - 1);
    }

    dom.overlay.classList.add('tm-modal-active');
    dom.overlay.setAttribute('aria-hidden', 'false');
    dom.epoch.textContent = 'Эпоха · ' + quest.era + ' · ' + quest.name;

    play('playUltimate');

    if (state.lives <= 0) {
      renderGameOver('Лимит ошибок исчерпан в предыдущей попытке');
    } else {
      renderGreeting();
    }
    return true;
  }

  function close() {
    if (!dom) return;
    clearTimers();
    dom.overlay.classList.remove('tm-modal-active');
    dom.overlay.setAttribute('aria-hidden', 'true');
    state.stage = 'greet';
    state.inBattle = false;
    if (typeof stopAllTargetVideosImmediate === 'function') stopAllTargetVideosImmediate();
  }

  window.TimeMachineQuest = {
    open: open,
    start: open,
    close: close,
    config: CONFIG
  };

  if (typeof window.startTimeMachine !== 'function') {
    window.startTimeMachine = function () {
      var id = (typeof getActiveHeroId === 'function') ? getActiveHeroId()
        : (typeof currentHeroId !== 'undefined' ? currentHeroId : null);
      if (id === null) return;
      open(id);
    };
  }
})();