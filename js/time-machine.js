/* ==========================================================
   МАШИНА ВРЕМЕНИ — КВЕСТ ТУРНИРА (21–22 ноября)
   Классический скрипт: без import/export, сам создаёт свой DOM.
   Поток: приветствие → квантовый скачок → вопросы →
          5 дуэлей → вызов Хранителю времени → сертификат.

   Публичный API:
     TimeMachineQuest.open(heroId)   — запустить квест
     TimeMachineQuest.start(heroId)  — алиас для совместимости
     TimeMachineQuest.close()        — закрыть

   Зависимости (все опциональны, проверяются через typeof):
     heroes-data.js  — HEROES, HERO_STATS_DATA, HERO_RANKS
     sound.js        — sfx
     passport.js     — registerCardDiscovery / registerTestPassed
     app.js          — stopAllTargetVideosImmediate
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
        'Ты только что оживил карточку чемпиона — и это не просто видео поверх картинки. AR-сканер считал мишень, хронометр турнира зафиксировал разлом, и карточка стала дверью.',
        'Поэтому турнир и называется «Машина времени»: каждая ожившая карточка запускает небольшое шахматное приключение в прошлое. Ты попадаешь в эпоху чемпиона — но его память закрыта, а соперники уже ждут за доской.',
        'Внутри карточки: вопросы о жизни чемпиона, пять дуэлей с хранителями эпох и финальный вызов — Хранителю времени на Lichess. На всё даётся пять жизней: ошибка в факте или проигранная дуэль забирает одну.'
      ],
      question: 'Ты готов начать?'
    },
    jumpSteps: [
      'Калибровка хронометра турнира…',
      'Разлом открыт: {era}',
      'Перенос сознания в тело {hero}… готово',
      'Память чемпиона заблокирована — её придётся восстанавливать.'
    ],
    challenge: [
      {
        icon: '📜',
        title: '{quiz} вопросов о жизни чемпиона',
        text: 'Факты из его биографии. Ошибка стоит одной жизни, а вопрос остаётся — его можно переиграть.'
      },
      {
        icon: '⚔️',
        title: '{duels} дуэлей с хранителями эпох',
        text: 'Сила соперников растёт: атака, защита и коронный приём. Проигрыш — минус жизнь и повтор дуэли.'
      },
      {
        icon: '⏳',
        title: 'Вызов Хранителю времени',
        text: 'Партия с ботом турнира на Lichess. Покажите ник и код судье: первые трое финалистов получают суперприз.'
      }
    ]
  };

  /* ---------------- состояние ---------------- */
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
    timers: [],
    shuffled: {},
    hp: { player: 50, enemy: 30, enemyMax: 30, energy: 1, enemyEnergy: 1, shield: false }
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

  function plural(n, forms) {
    var abs = Math.abs(n) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (last > 1 && last < 5) return forms[1];
    if (last === 1) return forms[0];
    return forms[2];
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

  function storageKey() {
    return CONFIG.storagePrefix + (state.quest ? state.quest.id : 'unknown');
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
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
    if (!hero) return null;
    if (typeof HERO_STATS_DATA === 'undefined') return null;
    var keys = Object.keys(HERO_STATS_DATA);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (HEROES && HEROES[key] && HEROES[key].id === hero.id) return Number(key);
      if (String(key) === String(hero.id)) return Number(key);
    }
    return null;
  }

  /* ---------------- данные квеста ---------------- */
  function buildDuels(hero) {
    var stats = (typeof HERO_STATS_DATA !== 'undefined' && HERO_STATS_DATA) ? HERO_STATS_DATA : null;
    var ranks = (typeof HERO_RANKS !== 'undefined' && HERO_RANKS) ? HERO_RANKS : null;
    var heroes = (typeof HEROES !== 'undefined' && HEROES) ? HEROES : null;
    var list = [];

    if (stats && heroes) {
      var ids = Object.keys(stats)
        .map(function (k) { return Number(k); })
        .filter(function (n) { return !isNaN(n); });

      var pool = ids.filter(function (id) {
        var h = heroes[id];
        return h && h.id !== hero.id;
      });

      pool.sort(function (a, b) {
        return (stats[a].atk || 0) - (stats[b].atk || 0);
      });

      var picked = [];
      var steps = 5;
      for (var i = 0; i < steps && pool.length; i++) {
        var pos = Math.round((i / (steps - 1)) * (pool.length - 1));
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
        var quote = h.quote ? String(h.quote).replace(/^«/, '').replace(/»$/, '') : 'Покажи, чему научился.';

        list.push({
          opponentName: h.name,
          opponentTitle: 'Хранитель ' + (idx + 1) + '-го рубежа',
          opponentRank: rankName,
          skillName: s.skillName || 'Коронный ход',
          hp: 30 + idx * 6,
          atk: 6 + idx + Math.round((s.atk || 7) / 3),
          defText: s.tip || 'готовит удар',
          introQuote: '«' + quote + '»',
          defeatQuote: '«Рубеж твой».'
        });
      });
    }

    if (!list.length) {
      for (var k = 0; k < 5; k++) {
        list.push({
          opponentName: 'Хранитель ' + (k + 1) + '-го рубежа',
          opponentTitle: 'Испытание ' + (k + 1),
          opponentRank: k < 2 ? 'МАЭСТРО' : (k < 4 ? 'ГРАНДМАСТЕР' : 'ЛЕГЕНДА'),
          skillName: 'Точный расчёт',
          hp: 30 + k * 6,
          atk: 7 + k,
          defText: 'держит оборону',
          introQuote: '«Проверим твою память.»',
          defeatQuote: '«Рубеж твой».'
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
      color: hero.color || '#d4b475',
      mission: quest.mission || 'Восстановить память чемпиона, пройти хранителей эпох и выстоять в партии с Хранителем времени.',
      quiz: quiz,
      duels: (quest.duels && quest.duels.length) ? quest.duels : buildDuels(hero)
    };
  }

  /* ---------------- разметка оверлея ---------------- */
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
      '    <button class="tm-close" type="button" id="tm-close" aria-label="Закрыть квест">✕</button>',
      '  </header>',
      '  <nav class="tm-pips" aria-label="Этапы квеста">',
      '    <span class="tm-pip" data-pip="greet">1. Приветствие</span>',
      '    <span class="tm-pip" data-pip="jump">2. Прыжок</span>',
      '    <span class="tm-pip" data-pip="quiz">3. Вопросы</span>',
      '    <span class="tm-pip" data-pip="duels">4. Дуэли</span>',
      '    <span class="tm-pip" data-pip="final">5. Хранитель</span>',
      '  </nav>',
      '  <div class="tm-body" id="tm-body"></div>',
      '</div>'
    ].join('');

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

  /* ---------------- общие блоки UI ---------------- */
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

  /* ---------------- 1. приветствие ---------------- */
  function renderGreeting() {
    setPips('greet');
    renderLives(false);
    var quest = state.quest;
    var g = CONFIG.greeting;

    dom.body.innerHTML = [
      '<div class="tm-greet">',
      '  <div class="tm-greet-top">',
      '    <div class="tm-portal">' + esc(quest.piece) + '</div>',
      '    <div>',
      '      <div class="tm-greet-hello">' + esc(g.hello) + '</div>',
      '      <div class="tm-greet-lead">' + esc(g.lead) + '</div>',
      '    </div>',
      '  </div>',
      '  <div class="tm-story">',
      g.paragraphs.map(function (p) { return '<p>' + esc(p) + '</p>'; }).join(''),
      '  </div>',
      '  <div class="tm-rules">',
      '    <div class="tm-rules-title">Карточка: ' + esc(quest.name) + (quest.title ? ' · ' + esc(quest.title) : '') + '</div>',
      '    Миссия: ' + esc(quest.mission),
      '  </div>',
      '  <div class="tm-greet-question">' + esc(g.question) + '</div>',
      '  <div class="tm-actions-row">',
      '    <button class="tm-btn tm-btn-ghost" type="button" id="tm-bio-btn">📖 Освежить биографию</button>',
      '    <button class="tm-btn" type="button" id="tm-ready-btn">Готов ➔</button>',
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
      '  <button class="tm-btn tm-btn-ghost tm-btn-sm" type="button" id="tm-bio-back">← Назад</button>',
      '</div>',
      '<div class="tm-story">',
      bio.map(function (s) {
        return '<p><strong style="color: var(--accent-gold);">' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>';
      }).join(''),
      '</div>',
      '<button class="tm-btn" type="button" id="tm-bio-next">Я готов ➔</button>'
    ].join('\n');

    dom.body.querySelector('#tm-bio-back').addEventListener('click', renderGreeting);
    dom.body.querySelector('#tm-bio-next').addEventListener('click', function () {
      play('playUltimate');
      renderJump();
    });
  }

  /* ---------------- 2. квантовый скачок ---------------- */
  function renderJump() {
    setPips('jump');
    var quest = state.quest;
    var steps = CONFIG.jumpSteps.map(function (line) {
      return line.replace('{hero}', quest.name).replace('{era}', quest.era);
    });

    dom.body.innerHTML = [
      '<div class="tm-jump">',
      '  <div class="jump-stage">',
      '    <div class="jump-ring r1"></div>',
      '    <div class="jump-ring r2"></div>',
      '    <div class="jump-ring r3"></div>',
      '    <div class="jump-core">' + esc(quest.piece) + '</div>',
      '  </div>',
      '  <div class="tm-title">Квантовый скачок</div>',
      '  <div class="tm-sub">Перенос в ' + esc(quest.era) + '</div>',
      '  <div class="jump-steps" id="tm-jump-steps">',
      steps.map(function (line, i) {
        return '<div class="jump-step" data-step="' + i + '"><span class="mark">▸</span><span>' + esc(line) + '</span></div>';
      }).join(''),
      '  </div>',
      '  <button class="tm-btn" type="button" id="tm-jump-next" hidden>К испытаниям ➔</button>',
      '</div>'
    ].join('\n');

    var nodes = dom.body.querySelectorAll('.jump-step');
    var next = dom.body.querySelector('#tm-jump-next');

    Array.prototype.forEach.call(nodes, function (node, i) {
      after(320 + i * 820, function () {
        node.classList.add('is-on');
        play('playMove');
      });
    });

    after(320 + nodes.length * 820, function () {
      next.hidden = false;
    });

    next.addEventListener('click', renderChallenge);
  }

  /* ---------------- брифинг ---------------- */
  function renderChallenge() {
    setPips('jump');
    var quizCount = state.quest.quiz.length;
    var duelCount = state.quest.duels.length;

    var cards = CONFIG.challenge.map(function (c) {
      return [
        '<div class="challenge-item">',
        '  <div class="challenge-icon">' + c.icon + '</div>',
        '  <div>',
        '    <div class="challenge-title">' + esc(c.title.replace('{quiz}', quizCount).replace('{duels}', duelCount)) + '</div>',
        '    <div class="challenge-text">' + esc(c.text) + '</div>',
        '  </div>',
        '</div>'
      ].join('\n');
    }).join('');

    dom.body.innerHTML = [
      '<div class="tm-stage-head">',
      '  <span class="tm-badge tm-badge-gold">Твой вызов</span>',
      '  <span class="tm-counter">' + CONFIG.maxLives + ' жизней на всё</span>',
      '</div>',
      '<div class="tm-title">' + esc(state.quest.name) + ': три ступени</div>',
      '<div class="challenge-list">' + cards + '</div>',
      '<button class="tm-btn" type="button" id="tm-challenge-next">К первому вопросу ➔</button>'
    ].join('\n');

    dom.body.querySelector('#tm-challenge-next').addEventListener('click', function () {
      play('playUltimate');
      state.quizIdx = 0;
      renderQuiz();
    });
  }

  /* ---------------- 3. вопросы ---------------- */
  function renderQuiz() {
    setPips('quiz');
    var quiz = state.quest.quiz;
    var total = quiz.length;
    var idxAtRender = state.quizIdx;
    var item = quiz[state.quizIdx];

    dom.pips.quiz.textContent = '3. Вопросы ' + (state.quizIdx + 1) + '/' + total;

    if (!state.shuffled[state.quizIdx]) {
      state.shuffled[state.quizIdx] = item.options
        .map(function (o) { return o; })
        .sort(function () { return Math.random() - 0.5; });
    }
    var options = state.shuffled[state.quizIdx];

    dom.body.innerHTML = [
      '<div class="tm-stage-head">',
      '  <span class="tm-badge">Память чемпиона</span>',
      '  <span class="tm-counter">' + (state.quizIdx + 1) + ' из ' + total + '</span>',
      '</div>',
      '<div class="tm-question">' + esc(item.q) + '</div>',
      '<div class="tm-options" id="tm-opts"></div>',
      '<div class="tm-feedback" id="tm-fb" hidden></div>',
      '<div class="tm-footer">',
      '  <div class="tm-warn">⚠️ Ошибка = −1 ♥</div>',
      '  <button class="tm-btn tm-btn-sm" type="button" id="tm-quiz-next" hidden>' +
        (state.quizIdx < total - 1 ? 'Следующий вопрос ➔' : 'К дуэлям ➔') + '</button>',
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
          fb.innerHTML = '<b>Память восстановлена.</b> ' + esc(opt.comment);
          next.hidden = false;
          return;
        }

        btn.classList.remove('is-dim');
        btn.classList.add('is-wrong');
        var alive = loseLife('Ошибка в факте биографии чемпиона');
        fb.className = 'tm-feedback is-bad';

        if (!alive) {
          fb.innerHTML = '<b>Квантовый коллапс.</b> Жизни закончились.';
          return;
        }

        fb.innerHTML = '<b>Хроно-искажение.</b> Потеряна 1 жизнь (осталось ' + state.lives +
          ' из ' + CONFIG.maxLives + ').<br>' + esc(opt.comment) +
          '<br><span class="tm-hintline">Соберитесь и попробуйте снова.</span>';

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

  /* ---------------- 4. дуэли ---------------- */
  function renderDuel() {
    setPips('duels');
    var duels = state.quest.duels;
    var total = duels.length;
    var duel = duels[state.duelIdx];

    state.hp = {
      player: 50,
      enemy: duel.hp || 30,
      enemyMax: duel.hp || 30,
      energy: 1,
      enemyEnergy: 1,
      shield: false
    };
    state.busy = false;

    dom.pips.duels.textContent = '4. Дуэли ' + (state.duelIdx + 1) + '/' + total;

    var dots = duels.map(function (_, i) {
      var cls = i < state.duelIdx ? 'is-done' : (i === state.duelIdx ? 'is-current' : '');
      return '<span class="duel-dot ' + cls + '"></span>';
    }).join('');

    var glyphs = ['♜', '♞', '♝', '♛', '♚'];

    dom.body.innerHTML = [
      '<div class="tm-duel">',
      '  <div class="tm-stage-head">',
      '    <span class="tm-badge tm-badge-red">Дуэль ' + (state.duelIdx + 1) + ' из ' + total + '</span>',
      '    <span class="duel-dots">' + dots + '</span>',
      '  </div>',
      '  <div class="tm-opponent">',
      '    <div class="tm-opp-avatar">' + (glyphs[state.duelIdx % glyphs.length]) + '</div>',
      '    <div>',
      '      <div class="tm-opp-name">' + esc(duel.opponentName) + '</div>',
      '      <div class="tm-opp-title">' + esc(duel.opponentTitle || '') +
        (duel.opponentRank ? ' · ' + esc(duel.opponentRank) : '') + '</div>',
      '      <div class="tm-quote">' + esc(duel.introQuote || '') + '</div>',
      '    </div>',
      '  </div>',
      '  <div class="tm-hp-grid">',
      '    <div class="tm-hp-col">',
      '      <div class="tm-hp-row"><span>Соперник</span><span id="tm-enemy-hp-num">' +
        state.hp.enemy + '/' + state.hp.enemyMax + '</span></div>',
      '      <div class="tm-hp-track"><div class="tm-hp-fill tm-hp-enemy" id="tm-enemy-hp-bar" style="width:100%"></div></div>',
      '    </div>',
      '    <div class="tm-hp-col">',
      '      <div class="tm-hp-row"><span>Ты · ' + esc(state.quest.shortName) + '</span><span id="tm-player-hp-num">50/50</span></div>',
      '      <div class="tm-hp-track"><div class="tm-hp-fill tm-hp-player" id="tm-player-hp-bar" style="width:100%"></div></div>',
      '    </div>',
      '  </div>',
      '  <div class="tm-log" id="tm-duel-log">Соперник ' + esc(duel.defText || 'готовит удар') + '. Выберите действие.</div>',
      '  <div class="tm-duel-actions" id="tm-duel-actions">',
      '    <button class="tm-cmd" type="button" data-move="strike">⚔️ Атака<small>10–14 урона</small></button>',
      '    <button class="tm-cmd" type="button" data-move="defend">🛡️ Защита<small>щит 75%, +1⚡, +4 HP</small></button>',
      '    <button class="tm-cmd" type="button" data-move="skill">⚡ Коронный приём<small id="tm-skill-led">заряд 1/2</small></button>',
      '  </div>',
      '</div>'
    ].join('\n');

    Array.prototype.forEach.call(dom.body.querySelectorAll('.tm-cmd'), function (btn) {
      btn.addEventListener('click', function () {
        duelMove(btn.getAttribute('data-move'));
      });
    });
  }

  function updateHp() {
    var enemyBar = dom.body.querySelector('#tm-enemy-hp-bar');
    var playerBar = dom.body.querySelector('#tm-player-hp-bar');
    var enemyNum = dom.body.querySelector('#tm-enemy-hp-num');
    var playerNum = dom.body.querySelector('#tm-player-hp-num');

    if (enemyBar) enemyBar.style.width = Math.max(0, Math.round((state.hp.enemy / state.hp.enemyMax) * 100)) + '%';
    if (playerBar) playerBar.style.width = Math.max(0, Math.round((state.hp.player / 50) * 100)) + '%';
    if (enemyNum) enemyNum.textContent = state.hp.enemy + '/' + state.hp.enemyMax;
    if (playerNum) playerNum.textContent = state.hp.player + '/50';
  }

  function duelMove(kind) {
    if (state.busy || state.stage !== 'duels') return;

    var duel = state.quest.duels[state.duelIdx];
    var log = dom.body.querySelector('#tm-duel-log');
    var actions = dom.body.querySelector('#tm-duel-actions');
    var led = dom.body.querySelector('#tm-skill-led');
    if (!log || !actions) return;

    if (kind === 'skill' && state.hp.energy < 2) {
      log.textContent = 'Недостаточно энергии: накопите 2⚡ защитой.';
      return;
    }

    state.busy = true;
    Array.prototype.forEach.call(actions.querySelectorAll('button'), function (b) { b.disabled = true; });
    state.hp.shield = false;

    var dmg = 0;
    var note = '';

    if (kind === 'strike') {
      dmg = rand(10, 14);
      note = 'Вы провели фигурную атаку на ' + dmg + ' урона.';
      play('playAttackHit');
    } else if (kind === 'defend') {
      state.hp.shield = true;
      state.hp.energy = Math.min(2, state.hp.energy + 1);
      state.hp.player = Math.min(50, state.hp.player + 4);
      dmg = 3;
      note = 'Щит поднят: +1⚡, +4 HP и контрудар на 3 урона.';
      play('playShield');
    } else {
      state.hp.energy = 0;
      dmg = rand(16, 18);
      note = 'Коронный приём «' + (duel.skillName || 'Коронный ход') + '» — ' + dmg + ' урона!';
      play('playUltimate');
    }

    if (led) led.textContent = 'заряд ' + state.hp.energy + '/2';
    state.hp.enemy = Math.max(0, state.hp.enemy - dmg);
    updateHp();
    log.textContent = note;

    if (state.hp.enemy <= 0) {
      log.textContent = note + ' ' + (duel.defeatQuote || '');
      play('playCorrect');
      after(1200, function () {
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

    after(900, function () {
      if (state.stage !== 'duels') return;

      var enemyDmg;
      if (state.hp.enemyEnergy >= 2) {
        state.hp.enemyEnergy = 0;
        enemyDmg = rand(12, 15);
        log.textContent = '💥 ' + duel.opponentName + ' применяет «' + (duel.skillName || 'приём') +
          '»: −' + enemyDmg + ' HP.';
      } else {
        state.hp.enemyEnergy = Math.min(2, state.hp.enemyEnergy + 1);
        enemyDmg = (duel.atk || 7) + rand(0, 2);
        log.textContent = '💥 ' + duel.opponentName + ' бьёт фигурами: −' + enemyDmg + ' HP.';
      }

      if (state.hp.shield) {
        enemyDmg = Math.max(2, Math.floor(enemyDmg * 0.25));
        log.textContent += ' Щит поглотил большую часть удара (−' + enemyDmg + ' HP).';
      }

      play('playDamageTaken');
      state.hp.player = Math.max(0, state.hp.player - enemyDmg);
      updateHp();

      if (state.hp.player <= 0) {
        log.textContent = '💀 Оборона сломана: поражение от ' + duel.opponentName + '.';
        var alive = loseLife('Поражение в дуэли против ' + duel.opponentName);
        if (alive) {
          after(1300, function () {
            if (state.stage === 'duels') renderDuel();
          });
        }
        return;
      }

      state.busy = false;
      Array.prototype.forEach.call(actions.querySelectorAll('button'), function (b) { b.disabled = false; });
    });
  }

  /* ---------------- 5. финал ---------------- */
  function renderFinal() {
    setPips('final');
    dom.pips.final.textContent = '5. Хранитель';

    dom.body.innerHTML = [
      '<div class="tm-final">',
      '  <div class="tm-final-icon">⌛♚⌛</div>',
      '  <div class="tm-title">Вызов Хранителю времени</div>',
      '  <div class="tm-sub">Партия с ботом турнира на Lichess</div>',
      '  <div class="tm-story tm-story-compact">',
      '    <p>' + esc(state.quest.name) + ' прошёл память чемпиона и хранителей эпох. Остался последний рубеж.</p>',
      '    <p class="tm-mission">🎁 Первые три участника, завершившие партию с ботом и показавшие сертификат судье, получают суперприз турнира.</p>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 1 · откройте профиль бота</div>',
      '    <a class="tm-btn tm-btn-cyan" href="' + esc(CONFIG.botUrl) + '" target="_blank" rel="noopener">🌐 @' +
        esc(CONFIG.botName) + ' на Lichess</a>',
      '    <div class="challenge-text">На странице бота нажмите «Вызвать на партию» и выберите контроль времени.</div>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 2 · параметры партии</div>',
      '    <label class="tm-field-label" for="tm-tc">Контроль времени</label>',
      '    <select class="tm-select" id="tm-tc">',
      '      <option value="5+3">5 + 3 (блиц)</option>',
      '      <option value="10+5" selected>10 + 5 (рапид)</option>',
      '      <option value="15+10">15 + 10 (классика)</option>',
      '    </select>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 3 · подтвердите результат</div>',
      '    <input class="tm-input" type="text" id="tm-nick" placeholder="Ваш ник на Lichess" autocomplete="off">',
      '    <div class="tm-err" id="tm-nick-err" hidden>Введите ник (минимум 3 символа) — судьям нужно зафиксировать результат.</div>',
      '    <button class="tm-btn" type="button" id="tm-verify">Я сыграл партию ➔ сертификат</button>',
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

  /* ---------------- 6. сертификат ---------------- */
  function renderVictory() {
    setPips('victory');
    play('playFanfare');

    var quest = state.quest;
    var time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    var code = 'QT-' + rand(1000, 9999) + '-' + String(quest.id).toUpperCase().slice(0, 3);

    var certificate = [
      'СЕРТИФИКАТ ФИНАЛИСТА ТУРНИРА «МАШИНА ВРЕМЕНИ»',
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
      '  <div class="tm-crown">🏆</div>',
      '  <div class="tm-title">Триумф: ты — ' + esc(quest.name) + '</div>',
      '  <div class="tm-sub">Память, хранители эпох и партия с Хранителем времени</div>',
      '  <div class="tm-seal">',
      '    <div class="tm-seal-title">Сертификат финалиста · топ-3</div>',
      '    <div class="tm-seal-champ">' + esc(quest.name) + '</div>',
      '    <div class="tm-seal-line">Игрок: <b>' + esc(state.nick) + '</b> · контроль ' + esc(state.timeControl) + '</div>',
      '    <div class="tm-seal-code">Код: ' + code + '</div>',
      '    <div class="tm-seal-sub">Время финиша ' + time + ' · жизнь ' + state.lives + '/' + CONFIG.maxLives +
        ' · ' + esc(CONFIG.dates) + '</div>',
      '  </div>',
      '  <div class="tm-rules">',
      '    <div class="tm-rules-title">Покажите этот экран судье</div>',
      '    Первые трое участников с верификационным кодом получают суперприз турнира.',
      '  </div>',
      '  <button class="tm-btn tm-btn-ghost" type="button" id="tm-download">⬇️ Скачать сертификат (.txt)</button>',
      '  <button class="tm-btn" type="button" id="tm-finish">Вернуться к карточке AR</button>',
      '</div>'
    ].join('\n');

    dom.body.querySelector('#tm-download').addEventListener('click', function () {
      var blob = new Blob([certificate], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'certificate-' + quest.id + '.txt';
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

  /* ---------------- выбывание ---------------- */
  function renderGameOver(reason) {
    state.stage = 'gameover';
    Object.keys(dom.pips).forEach(function (key) {
      dom.pips[key].classList.remove('is-active');
    });
    play('playDamageTaken');

    dom.body.innerHTML = [
      '<div class="tm-gameover">',
      '  <div class="tm-go-icon">⛔⏳</div>',
      '  <div class="tm-title tm-title-red">Выбывание из конкурса</div>',
      '  <div class="tm-sub">Жизни закончились (0 из ' + CONFIG.maxLives + ')</div>',
      '  <div class="tm-go-reason"><b>Причина:</b> ' + esc(reason) + '</div>',
      '  <div class="tm-go-note">Прохождение этой карточки в турнирном режиме остановлено. Биография и свободные дуэли остаются доступны. Пересдачу открывает судья мастер-кодом.</div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Мастер-код судьи</div>',
      '    <input class="tm-input" type="password" id="tm-pin" placeholder="Код судьи" autocomplete="off">',
      '    <div class="tm-err" id="tm-pin-err" hidden>Неверный код. Обратитесь к организаторам турнира.</div>',
      '    <button class="tm-btn" type="button" id="tm-judge">Судейский сброс</button>',
      '  </div>',
      '  <button class="tm-btn tm-btn-ghost" type="button" id="tm-close-go">Закрыть портал</button>',
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

  /* ---------------- публичный API ---------------- */
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
    dom.epoch.textContent = 'Ты в теле: ' + quest.name + ' · ' + quest.era;

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
      if (typeof currentHeroId === 'undefined' || currentHeroId === null) return;
      open(currentHeroId);
    };
  }
})();