/* ==========================================================
   МАШИНА ВРЕМЕНИ — КВЕСТ (встраиваемая версия)

   Классический скрипт, без import/export. Сам создаёт DOM
   внутри body, работает поверх AR-сцены.

   Подключение (порядок важен):
     heroes-data.js → quest-data.js → duel-puzzles.js → sound.js
     → net-duel.js → time-machine.js → app.js

   Этап 4 «Путь героя» идёт через NetDuel.startQuestDuel().
   Этап 5 «Хранитель времени» — партия с ботом на Lichess.

   API:
     TimeMachineQuest.open(heroId)
     TimeMachineQuest.start(heroId)
     TimeMachineQuest.close()
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = {
    dates: '21–22 ноября',
    botName: 'Watson-bot',
    botUrl: 'https://lichess.org/@/Watson-bot',
    maxLives: 10,
    storagePrefix: 'tmq_v4_',
    judgeCode: '2026',
    heroGreeting: 'Ты оживил карточку чемпиона — и она стала дверью в его эпоху. Впереди пять этапов: память чемпиона, пробуждение силы, скрытая угроза, пять дуэлей и партия с Хранителем времени. На весь путь десять жизней.',
    route: [
      { key: 'quiz', num: 'I', title: 'Вспомнить всё', sub: 'Биография до чемпионства', glyph: '❖',
        text: 'Факты из жизни чемпиона до того, как он взял корону. Ошибка стоит жизни, но вопрос можно переиграть.' },
      { key: 'attack', num: 'II', title: 'Пробуждение силы', sub: 'Задачи на атаку', glyph: '⚔',
        text: 'Мат в один ход. Фигуры двигаются на доске — так же, как в тактической дуэли.' },
      { key: 'defense', num: 'III', title: 'Скрытая угроза', sub: 'Задачи на защиту', glyph: '⛨',
        text: 'Соперник уже грозит матом. Найдите единственный ход, который спасает позицию.' },
      { key: 'duels', num: 'IV', title: 'Путь героя', sub: 'Пять дуэлей', glyph: '♞',
        text: 'Настоящая арена NetDuel: 50 HP, атака, защита, коронный ход и тактическая доска на 30 секунд.' },
      { key: 'final', num: 'V', title: 'Финальная схватка', sub: 'Хранитель времени', glyph: '♚',
        text: 'Последний рубеж — партия с ботом турнира на Lichess и грамота финалиста.' }
    ]
  };

  var state = {
    heroId: null,
    hero: null,
    quest: null,
    screen: 'greet',
    stage: 0,
    step: 0,
    lives: CONFIG.maxLives,
    duelIdx: 0,
    chosen: null,
    answered: false,
    missed: false,
    nick: '',
    tc: '10+5',
    code: '',
    busy: false,
    inBattle: false,
    timers: []
  };

  var dom = null;

  /* ==========================================================
     ЗВУК
     ========================================================== */
  var Sound = (function () {
    var ctx = null;
    var master = null;

    function init() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.4;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function tone(freq, delay, dur, gain, type, to) {
      if (!init()) return;
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain || 0.12, t0 + Math.min(0.12, dur * 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    return {
      init: init,
      choir: function () {
        init();
        [261.63, 329.63, 392, 523.25].forEach(function (f, i) {
          tone(f, i * 0.09, 3.2, 0.1, i % 2 ? 'triangle' : 'sine');
        });
        tone(1046.5, 1.1, 1.6, 0.05);
      },
      warp: function () {
        init();
        if (!ctx) return;
        var dur = 2.2;
        var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 1.1;
        filter.frequency.setValueAtTime(280, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(4200, ctx.currentTime + dur);
        var g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.35);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        src.connect(filter);
        filter.connect(g);
        g.connect(master);
        src.start();
        tone(170, 0, 1.8, 0.16, 'sawtooth', 38);
        tone(880, 1.9, 0.9, 0.09);
      },
      step: function () { tone(880, 0, 0.13, 0.05, 'triangle', 620); },
      correct: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.06, 0.32, 0.1); });
      },
      wrong: function () { tone(180, 0, 0.3, 0.14, 'sawtooth', 100); },
      fanfare: function () {
        [392, 523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, i * 0.14, 0.9, 0.09); });
        [523.25, 659.25, 783.99].forEach(function (f) { tone(f, 0.7, 1.5, 0.07); });
      }
    };
  })();

  var SOUND_MAP = {
    playUltimate: 'choir',
    playMove: 'step',
    playCorrect: 'correct',
    playWrong: 'wrong',
    playFanfare: 'fanfare',
    playShield: 'correct',
    playBattleStart: 'warp',
    playAttackHit: 'wrong',
    playDamageTaken: 'wrong'
  };

  function unlockAudio() {
    try {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx.init === 'function') sfx.init();
      Sound.init();
    } catch (e) {}
  }

  function play(name) {
    try {
      unlockAudio();
      var key = SOUND_MAP[name] || name;
      if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') {
        sfx[name]();
        return;
      }
      if (typeof Sound[key] === 'function') Sound[key]();
    } catch (e) {}
  }

  /* ==========================================================
     УТИЛИТЫ
     ========================================================== */
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
    return !!dom && dom.overlay.classList.contains('tmq-open');
  }

  function storageKey() {
    return CONFIG.storagePrefix + (state.heroId || 'unknown');
  }

  function saveProgress() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        stage: state.stage,
        step: state.step,
        duelIdx: state.duelIdx,
        lives: state.lives
      }));
    } catch (e) {}
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function heroNumericId(hero) {
    if (!hero || typeof HERO_STATS_DATA === 'undefined') return null;
    var keys = Object.keys(HERO_STATS_DATA);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (typeof HEROES !== 'undefined' && HEROES[key] && HEROES[key].id === hero.id) return Number(key);
      if (String(key) === String(hero.id)) return Number(key);
    }
    return null;
  }

  /* ==========================================================
     ГОЛОГРАММА
     ========================================================== */
  var PIECES = {
    rook: '<path d="M30 20h10v10h10V20h10v10h10V20h10v20l-8 5v33H38V45l-8-5z"/><path d="M34 82h52l7 12H27z"/>',
    queen: '<path d="M24 28l10 24h52l10-24-16 13-9-21-11 21-11-21-9 21z"/><path d="M34 56h52l5 18H29z"/><path d="M28 82h64l6 12H22z"/>',
    king: '<path d="M54 8h12v12h12v12H66v12H54V32H42V20h12z"/><path d="M36 50h48l7 28H29z"/><path d="M26 84h68l6 10H20z"/>',
    bishop: '<circle cx="60" cy="22" r="11"/><path d="M60 34l16 24H44z"/><path d="M44 62h32l6 18H38z"/><path d="M32 84h56l6 10H26z"/>',
    pawn: '<circle cx="60" cy="26" r="13"/><path d="M48 40h24l6 18H42z"/><path d="M38 62h44l7 20H31z"/><path d="M30 84h60l6 10H24z"/>'
  };

  function hologram(piece) {
    var body = PIECES[piece] || PIECES.king;
    return '<div class="tmq-holo">' +
      '<span class="tmq-ring r1"></span><span class="tmq-ring r2"></span><span class="tmq-ring r3"></span>' +
      '<span class="tmq-orbit o1"><i></i></span><span class="tmq-orbit o2"><i></i></span>' +
      '<div class="tmq-fig"><svg viewBox="0 0 120 100" aria-hidden="true">' +
      '<g class="tmq-fig-halo">' + body + '</g><g class="tmq-fig-body">' + body + '</g>' +
      '</svg></div>' +
      '<span class="tmq-floor"></span>' +
      '<span class="tmq-spark s1"></span><span class="tmq-spark s2"></span>' +
      '<span class="tmq-spark s3"></span><span class="tmq-spark s4"></span>' +
      '</div>';
  }

  /* ==========================================================
     СБОРКА ДАННЫХ КВЕСТА
     ========================================================== */
  function fromHeroPuzzles(hero) {
    if (!hero || !hero.puzzles || !hero.puzzles.length) return [];
    return hero.puzzles.map(function (p) {
      return {
        q: p.desc || 'Вопрос о чемпионе',
        options: (p.options || []).map(function (o) {
          return { text: o.text, correct: !!o.correct, comment: o.comment || '' };
        })
      };
    });
  }

  function fromDuelPuzzles(kind) {
    var pool = kind === 'defense'
      ? (typeof DUEL_DEFENSE_PUZZLES !== 'undefined' ? DUEL_DEFENSE_PUZZLES : null)
      : (typeof DUEL_STRIKE_PUZZLES !== 'undefined' ? DUEL_STRIKE_PUZZLES : null);
    if (!pool || !pool.length) return [];
    return pool.slice(0, 2).map(function (p) {
      return {
        task: p.desc || (kind === 'defense' ? 'Найдите лучшую защиту.' : 'Найдите лучший ход.'),
        fen: p.fen,
        from: p.move.from,
        to: p.move.to,
        hint: 'Ищите форсированный ход: шах, взятие или мат.',
        why: 'Точный тактический удар решает исход партии.'
      };
    });
  }

  function buildDuels(hero) {
    var rivals = (window.QUEST_RIVALS && window.QUEST_RIVALS[hero.id]) || null;
    if (rivals && rivals.length) {
      return rivals.map(function (r) {
        return { enemyId: r.enemyId, name: r.n, years: r.y, style: r.s };
      });
    }

    if (typeof HERO_STATS_DATA === 'undefined' || typeof HEROES === 'undefined') return [];
    var ids = Object.keys(HERO_STATS_DATA)
      .map(Number)
      .filter(function (id) { return !isNaN(id) && id < 100 && HEROES[id] && HEROES[id].id !== hero.id; })
      .slice(0, 5);

    return ids.map(function (id, i) {
      return { enemyId: id, name: HEROES[id].name, years: 'Рубеж ' + (i + 1), style: 'Хранитель эпохи' };
    });
  }

  function resolveQuest(heroId) {
    if (typeof HEROES === 'undefined' || !HEROES) return null;
    var hero = HEROES[heroId] || HEROES[String(heroId)];
    if (!hero) return null;

    var data = (window.QUEST_DATA && window.QUEST_DATA[hero.id]) || {};
    var eras = (window.QUEST_ERAS && window.QUEST_ERAS[hero.id]) || {};

    var quiz = (data.bioQuiz && data.bioQuiz.length) ? data.bioQuiz : fromHeroPuzzles(hero);
    var attack = (data.attack && data.attack.length) ? data.attack : fromDuelPuzzles('attack');
    var defense = (data.defense && data.defense.length) ? data.defense : fromDuelPuzzles('defense');

    if (!quiz.length) return null;

    return {
      id: hero.id || heroId,
      name: hero.name || 'Чемпион',
      shortName: (hero.name || 'Чемпион').split(' ').pop(),
      era: eras.era || hero.title || 'эпоха чемпиона',
      piece: eras.piece || 'king',
      mission: data.mission || 'Пройти пять этапов пути и выстоять в партии с Хранителем времени.',
      quiz: quiz,
      attack: attack,
      defense: defense,
      duels: buildDuels(hero)
    };
  }

  /* ==========================================================
     DOM
     ========================================================== */
  function ensureDOM() {
    if (dom) return dom;

    var overlay = document.createElement('div');
    overlay.className = 'tmq-overlay';
    overlay.id = 'tmq-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="tmq-card" role="dialog" aria-modal="true" aria-label="Квест Машина времени">' +
        '<header class="tmq-head">' +
          '<div class="tmq-head-info">' +
            '<div class="tmq-epoch" id="tmq-epoch">—</div>' +
            '<div class="tmq-lives-row"><span class="tmq-lives-label">жизни</span>' +
              '<div class="tmq-lives" id="tmq-lives"></div></div>' +
          '</div>' +
          '<button class="tmq-close" type="button" id="tmq-close" aria-label="Закрыть квест">✕</button>' +
        '</header>' +
        '<div class="tmq-body" id="tmq-body"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      body: overlay.querySelector('#tmq-body'),
      lives: overlay.querySelector('#tmq-lives'),
      epoch: overlay.querySelector('#tmq-epoch'),
      closeBtn: overlay.querySelector('#tmq-close')
    };

    dom.closeBtn.addEventListener('click', close);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen()) close();
    });

    return dom;
  }

  function renderLives(shake) {
    if (!dom || !dom.lives) return;
    var out = '';
    for (var i = 1; i <= CONFIG.maxLives; i++) {
      out += '<span class="tmq-heart' + (i <= state.lives ? '' : ' is-lost') + '">' +
        (i <= state.lives ? '♥' : '♡') + '</span>';
    }
    dom.lives.innerHTML = out;
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
      after(700, function () { renderGameOver(reason); });
      return false;
    }
    return true;
  }

  function chapter(num, title, note) {
    return '<div class="tmq-chapter">' +
      '<span class="tmq-chapter-num">' + esc(num) + '</span>' +
      '<span class="tmq-chapter-title">' + esc(title) + '</span>' +
      '<span class="tmq-chapter-note">' + esc(note || '') + '</span>' +
      '</div>';
  }

  function setBody(html) {
    dom.body.innerHTML = html;
    dom.body.scrollTop = 0;
  }

  /* ==========================================================
     I. ПРИВЕТСТВИЕ
     ========================================================== */
  function renderGreet() {
    state.screen = 'greet';
    renderLives(false);
    var q = state.quest;
    var rankName = (state.hero && state.hero.rank && state.hero.rank.name) ? state.hero.rank.name : 'ЛЕГЕНДА';

    setBody(
      chapter('I', 'Пролог', q.era) +
      hologram(q.piece) +
      '<div class="tmq-greet">' +
        '<div class="tmq-hello">Добро пожаловать<br>на турнир «Машина времени»!</div>' +
        '<div class="tmq-lead">' + esc(q.era) + ' · ' + esc(q.name) + '</div>' +
        '<div class="tmq-rank-chip">' + esc(rankName) + '</div>' +
        '<div class="tmq-story"><p>' + esc(CONFIG.heroGreeting) + '</p>' +
        '<p>' + esc(q.mission) + '</p></div>' +
        '<div class="tmq-actions">' +
          '<button class="tmq-btn tmq-btn-ghost" type="button" id="tmq-bio">Биография</button>' +
          '<button class="tmq-btn" type="button" id="tmq-jump">Прыжок во времени</button>' +
        '</div>' +
        '<div class="tmq-hintline">Звук включён · квест можно закрыть и продолжить позже</div>' +
      '</div>'
    );

    dom.body.querySelector('#tmq-bio').addEventListener('click', renderBio);
    dom.body.querySelector('#tmq-jump').addEventListener('click', function () {
      play('playUltimate');
      renderWarp();
    });
  }

  function renderBio() {
    var bio = (state.hero && state.hero.bio) ? state.hero.bio : [];
    setBody(
      '<div class="tmq-stage-head">' +
        '<span class="tmq-badge">Хроники · ' + esc(state.quest.name) + '</span>' +
        '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-bio-back">Назад</button>' +
      '</div>' +
      '<div class="tmq-story">' +
        bio.map(function (s) {
          return '<p><strong>' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>';
        }).join('') +
      '</div>' +
      '<button class="tmq-btn" type="button" id="tmq-bio-next">Прыжок во времени</button>'
    );

    dom.body.querySelector('#tmq-bio-back').addEventListener('click', renderGreet);
    dom.body.querySelector('#tmq-bio-next').addEventListener('click', function () {
      play('playUltimate');
      renderWarp();
    });
  }

  /* ==========================================================
     II. ВАРП
     ========================================================== */
  function renderWarp() {
    state.screen = 'warp';
    var q = state.quest;
    play('playUltimate');

    setBody(
      '<div class="tmq-warp">' +
        '<div class="tmq-tunnel"></div>' +
        '<div class="tmq-streaks"></div>' +
        '<div class="tmq-warp-core"></div>' +
        '<div class="tmq-warp-text">' +
          '<div class="tmq-warp-label">ВАРП-ПРЫЖОК</div>' +
          '<div class="tmq-warp-target">' + esc(q.era) + '</div>' +
          '<div class="tmq-warp-sub">держитесь за партию...</div>' +
        '</div>' +
      '</div>'
    );

    play('playBattleStart');

    after(2600, function () {
      state.stage = 0;
      renderMap(true);
    });
  }

  /* ==========================================================
     III. КАРТА ПЯТИ ЭТАПОВ
     ========================================================== */
  function renderMap(fresh) {
    state.screen = 'map';
    renderLives(false);
    var q = state.quest;
    var current = state.stage; // 0..5

    var cards = CONFIG.route.map(function (item, i) {
      var status = i < current ? 'done' : i === current ? 'active' : 'locked';
      var label = status === 'done' ? 'Пройдено' : status === 'active' ? 'Сейчас' : 'Впереди';
      var meta = item.key === 'quiz' ? q.quiz.length + ' вопроса'
        : item.key === 'attack' ? q.attack.length + ' задачи'
        : item.key === 'defense' ? q.defense.length + ' задачи'
        : item.key === 'duels' ? q.duels.length + ' дуэлей'
        : 'Lichess';

      return '<article class="tmq-route ' + status + '">' +
        '<div class="tmq-rail"><span class="tmq-dot">' + (status === 'done' ? '✓' : item.num) + '</span>' +
        '<span class="tmq-rail-line"></span></div>' +
        '<div class="tmq-route-body">' +
          '<div class="tmq-route-top"><span class="tmq-route-glyph">' + item.glyph + '</span>' +
          '<span class="tmq-route-status">' + label + '</span></div>' +
          '<div class="tmq-route-title">' + esc(item.title) + '</div>' +
          '<div class="tmq-route-sub">' + esc(item.sub) + ' · ' + esc(meta) + '</div>' +
          '<p class="tmq-route-text">' + esc(item.text) + '</p>' +
          (status === 'active'
            ? '<button class="tmq-btn tmq-btn-sm" type="button" data-enter="' + i + '">Войти на этап</button>'
            : '') +
        '</div>' +
      '</article>';
    }).join('');

    setBody(
      chapter(fresh ? 'II' : '···', fresh ? 'Дверь открыта' : 'Карта пути', q.era) +
      '<div class="tmq-title">' + (fresh ? 'Вы проснулись в ' + esc(q.era) : 'Пять этапов становления') + '</div>' +
      '<div class="tmq-story"><p>' + esc(q.mission) + '</p></div>' +
      '<div class="tmq-route-list">' + cards + '</div>' +
      '<div class="tmq-mapnote">Жизни: <b>' + state.lives + '</b> из ' + CONFIG.maxLives +
      ' · дуэли: <b>' + state.duelIdx + '/' + q.duels.length + '</b></div>'
    );

    var buttons = dom.body.querySelectorAll('[data-enter]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        play('playMove');
        enterStage();
      });
    });
  }

  function enterStage() {
    var key = CONFIG.route[state.stage] ? CONFIG.route[state.stage].key : 'final';
    state.step = 0;
    state.answered = false;
    state.chosen = null;
    state.missed = false;

    if (key === 'quiz') renderQuiz();
    else if (key === 'attack') renderPuzzle('attack');
    else if (key === 'defense') renderPuzzle('defense');
    else if (key === 'duels') renderDuel();
    else renderFinal();
  }

  /* ==========================================================
     IV. БИОГРАФИЯ
     ========================================================== */
  function renderQuiz() {
    state.screen = 'quiz';
    var q = state.quest;
    var item = q.quiz[state.step];
    if (!item) { finishStage(); return; }

    var total = q.quiz.length;
    var options = item.options.map(function (opt, i) {
      var cls = 'tmq-opt';
      var mark = String.fromCharCode(1040 + i);
      if (state.answered) {
        if (opt.correct) { cls += ' is-correct'; mark = '✓'; }
        else if (i === state.chosen) { cls += ' is-wrong'; mark = '✕'; }
      }
      return '<button class="' + cls + '" type="button" data-opt="' + i + '"' +
        (state.answered ? ' disabled' : '') + '>' +
        '<span class="tmq-opt-mark">' + mark + '</span>' +
        '<span class="tmq-opt-text">' + esc(opt.text) + '</span></button>';
    }).join('');

    var chosen = state.chosen !== null ? item.options[state.chosen] : null;
    var correct = null;
    item.options.forEach(function (o) { if (o.correct) correct = o; });

    var feedback = '';
    if (state.answered && chosen) {
      feedback = '<div class="tmq-feedback ' + (chosen.correct ? 'is-ok' : 'is-bad') + '">' +
        '<b>' + (chosen.correct ? 'Верно.' : 'Неверно.') + '</b> ' + esc(chosen.comment) +
        (!chosen.correct && correct ? '<br><span class="tmq-dimline">Правильный ответ: ' + esc(correct.text) + '. ' + esc(correct.comment) + '</span>' : '') +
        '<div class="tmq-actions"><button class="tmq-btn tmq-btn-sm" type="button" id="tmq-quiz-next">' +
        (chosen.correct ? (state.step < total - 1 ? 'Дальше' : 'К карте пути') : 'Попробовать снова') +
        '</button></div></div>';
    }

    setBody(
      chapter(CONFIG.route[0].num, CONFIG.route[0].title, (state.step + 1) + ' / ' + total) +
      '<div class="tmq-question">' + esc(item.q) + '</div>' +
      '<div class="tmq-options">' + options + '</div>' +
      feedback +
      '<div class="tmq-warn">Ошибка −1 ♥</div>'
    );

    Array.prototype.forEach.call(dom.body.querySelectorAll('[data-opt]'), function (btn) {
      btn.addEventListener('click', function () {
        if (state.answered) return;
        var idx = Number(btn.getAttribute('data-opt'));
        state.chosen = idx;
        state.answered = true;

        if (item.options[idx].correct) play('playCorrect');
        else loseLife('Ошибка в факте биографии чемпиона');

        if (state.lives > 0) renderQuiz();
      });
    });

    var next = dom.body.querySelector('#tmq-quiz-next');
    if (next) {
      next.addEventListener('click', function () {
        var chosenOpt = item.options[state.chosen];
        if (!chosenOpt || !chosenOpt.correct) {
          state.answered = false;
          state.chosen = null;
          renderQuiz();
          return;
        }
        play('playMove');
        state.answered = false;
        state.chosen = null;
        if (state.step < total - 1) {
          state.step++;
          saveProgress();
          renderQuiz();
        } else {
          finishStage();
        }
      });
    }
  }

  /* ==========================================================
     V. ЗАДАЧИ НА ДОСКЕ
     ========================================================== */
  var FILES = 'abcdefgh';
  var GLYPH = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  function parseFen(fen) {
    var parts = String(fen).split(' ');
    var map = {};
    (parts[0] || '').split('/').forEach(function (row, i) {
      var rank = 8 - i;
      var file = 0;
      for (var c = 0; c < row.length; c++) {
        var ch = row[c];
        if (ch >= '1' && ch <= '8') file += Number(ch);
        else { map[FILES[file] + rank] = ch; file++; }
      }
    });
    return { map: map, turn: parts[1] || 'w' };
  }

  function isLegal(fen, from, to) {
    if (typeof Chess === 'undefined') return true;
    try {
      var game = new Chess(fen);
      return !!game.move({ from: from, to: to, promotion: 'q' });
    } catch (e) {
      return false;
    }
  }

  function paintBoard(host, fen, solution, onResult) {
    var parsed = parseFen(fen);
    var map = parsed.map;
    var turn = parsed.turn;
    var selected = null;

    host.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'tmq-board';
    var cells = {};

    for (var rank = 8; rank >= 1; rank--) {
      for (var file = 0; file < 8; file++) {
        var sq = FILES[file] + rank;
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'tmq-sq ' + ((file + rank) % 2 === 1 ? 'is-dark' : 'is-light');
        cell.setAttribute('data-sq', sq);
        cell.setAttribute('aria-label', 'Поле ' + sq);

        var piece = map[sq];
        if (piece) {
          var span = document.createElement('span');
          span.className = 'tmq-pc ' + (piece === piece.toUpperCase() ? 'is-w' : 'is-b');
          span.textContent = GLYPH[piece] || '';
          cell.appendChild(span);
        }

        if (file === 0) {
          var rl = document.createElement('i');
          rl.className = 'tmq-lbl tmq-lbl-rank';
          rl.textContent = String(rank);
          cell.appendChild(rl);
        }
        if (rank === 1) {
          var fl = document.createElement('i');
          fl.className = 'tmq-lbl tmq-lbl-file';
          fl.textContent = FILES[file];
          cell.appendChild(fl);
        }

        cells[sq] = cell;
        grid.appendChild(cell);
      }
    }

    host.appendChild(grid);

    grid.addEventListener('click', function (event) {
      var cell = event.target.closest('.tmq-sq');
      if (!cell) return;
      var sq = cell.getAttribute('data-sq');
      var piece = map[sq];
      var color = piece ? (piece === piece.toUpperCase() ? 'w' : 'b') : null;

      if (selected === sq) {
        cells[sq].classList.remove('is-sel');
        selected = null;
        return;
      }

      if (color && color === turn) {
        if (selected) cells[selected].classList.remove('is-sel');
        selected = sq;
        cell.classList.add('is-sel');
        play('playMove');
        return;
      }

      if (!selected) return;

      var from = selected;
      cells[from].classList.remove('is-sel');
      selected = null;

      if (!isLegal(fen, from, sq)) return;

      if (from === solution.from && sq === solution.to) {
        cells[from].classList.add('is-ok-from');
        cells[sq].classList.add('is-ok-to');
        onResult(true);
      } else {
        cells[from].classList.add('is-bad-from');
        cells[sq].classList.add('is-bad-to');
        host.classList.remove('is-shake');
        void host.offsetWidth;
        host.classList.add('is-shake');
        onResult(false);
        setTimeout(function () {
          Array.prototype.forEach.call(grid.children, function (c) {
            c.classList.remove('is-bad-from', 'is-bad-to');
          });
        }, 900);
      }
    });
  }

  function renderPuzzle(kind) {
    state.screen = kind;
    var q = state.quest;
    var list = q[kind];
    var item = list[state.step];
    if (!item) { finishStage(); return; }

    var route = kind === 'attack' ? CONFIG.route[1] : CONFIG.route[2];
    var turnLabel = item.fen.split(' ')[1] === 'b' ? 'Ход чёрных' : 'Ход белых';

    setBody(
      chapter(route.num, route.title, (state.step + 1) + ' / ' + list.length) +
      '<div class="tmq-question">' + esc(item.task) + '</div>' +
      '<div class="tmq-sides">' + turnLabel + ' · нажмите фигуру, затем поле</div>' +
      '<div class="tmq-board-host" id="tmq-board"></div>' +
      '<div class="tmq-puzzle-hint" id="tmq-hint"' + (state.missed ? '' : ' hidden') + '>' +
        '<b>Подсказка.</b> ' + esc(item.hint) + '</div>' +
      '<div id="tmq-puzzle-fb"></div>' +
      (state.missed ? '' : '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-show-hint">Показать подсказку</button>') +
      '<div class="tmq-warn">Ошибка −1 ♥</div>'
    );

    var host = dom.body.querySelector('#tmq-board');
    paintBoard(host, item.fen, item, function (ok) {
      if (ok) {
        play('playCorrect');
        var fb = dom.body.querySelector('#tmq-puzzle-fb');
        if (fb) {
          fb.innerHTML = '<div class="tmq-feedback is-ok"><b>Точный ход!</b> ' + esc(item.why) +
            '<div class="tmq-actions"><button class="tmq-btn tmq-btn-sm" type="button" id="tmq-puzzle-next">' +
            (state.step < list.length - 1 ? 'Дальше' : 'К карте пути') + '</button></div></div>';
          var next = fb.querySelector('#tmq-puzzle-next');
          next.addEventListener('click', function () {
            play('playMove');
            if (state.step < list.length - 1) {
              state.step++;
              saveProgress();
              renderPuzzle(kind);
            } else {
              finishStage();
            }
          });
        }
      } else {
        state.missed = true;
        loseLife('Неверный ход в тактической задаче');
        if (state.lives <= 0) return;
        var hint = dom.body.querySelector('#tmq-hint');
        if (hint) hint.hidden = false;
      }
    });

    var showHint = dom.body.querySelector('#tmq-show-hint');
    if (showHint) {
      showHint.addEventListener('click', function () {
        var hint = dom.body.querySelector('#tmq-hint');
        if (hint) hint.hidden = false;
        state.missed = true;
        play('playMove');
      });
    }
  }

  /* ==========================================================
     VI. ДУЭЛИ ЧЕРЕЗ NetDuel
     ========================================================== */
  function renderDuel() {
    state.screen = 'duels';
    var q = state.quest;
    var duel = q.duels[state.duelIdx];
    if (!duel) { finishStage(); return; }

    var dots = q.duels.map(function (_, i) {
      return '<span class="tmq-pip ' + (i < state.duelIdx ? 'is-done' : i === state.duelIdx ? 'is-current' : '') + '"></span>';
    }).join('');

    setBody(
      chapter(CONFIG.route[3].num, CONFIG.route[3].title, 'Рубеж ' + (state.duelIdx + 1) + ' / ' + q.duels.length) +
      '<div class="tmq-stage-head">' +
        '<span class="tmq-badge tmq-badge-red">Хранитель рубежа</span>' +
        '<span class="tmq-pips">' + dots + '</span>' +
      '</div>' +
      '<div class="tmq-opp">' +
        '<div class="tmq-opp-ava">♟</div>' +
        '<div><div class="tmq-opp-name">' + esc(duel.name) + '</div>' +
        '<div class="tmq-opp-title">' + esc(duel.years || '') + '</div>' +
        '<div class="tmq-quote">' + esc(duel.style || '') + '</div></div>' +
      '</div>' +
      '<div class="tmq-story"><p>Дуэль идёт на настоящей арене: карточки, 50 HP, атака, защита и тактическая доска на 30 секунд. Победа открывает следующий рубеж.</p></div>' +
      '<div class="tmq-log" id="tmq-duel-log">Готовы выйти на арену?</div>' +
      '<button class="tmq-btn" type="button" id="tmq-duel-start">Выйти на арену</button>' +
      '<div class="tmq-warn">Поражение −1 ♥ и повтор рубежа</div>'
    );

    dom.body.querySelector('#tmq-duel-start').addEventListener('click', startQuestDuel);
  }

  function startQuestDuel() {
    if (state.busy || state.inBattle) return;

    if (typeof NetDuel === 'undefined' || typeof NetDuel.startQuestDuel !== 'function') {
      var log = dom.body.querySelector('#tmq-duel-log');
      if (log) log.textContent = 'NetDuel не найден: подключите js/net-duel.js с методом startQuestDuel().';
      return;
    }

    var duel = state.quest.duels[state.duelIdx];
    state.busy = true;
    state.inBattle = true;

    var btn = dom.body.querySelector('#tmq-duel-start');
    if (btn) { btn.disabled = true; btn.textContent = 'Бой идёт...'; }

    hideQuestForBattle();

    var started = NetDuel.startQuestDuel({
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
      if (btn) { btn.disabled = false; btn.textContent = 'Выйти на арену'; }
      var logEl = dom.body.querySelector('#tmq-duel-log');
      if (logEl) logEl.textContent = 'Не удалось начать дуэль: карточка чемпиона не определена.';
    }
  }

  function hideQuestForBattle() {
    if (!dom) return;
    dom.overlay.classList.remove('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'true');
  }

  function restoreQuestAfterBattle() {
    if (!dom) return;
    dom.overlay.classList.add('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'false');
  }

  function handleDuelResult(outcome) {
    var duel = state.quest.duels[state.duelIdx];
    var log = dom.body.querySelector('#tmq-duel-log');
    var btn = dom.body.querySelector('#tmq-duel-start');

    if (outcome === 'win' || outcome === true) {
      if (log) log.textContent = 'Рубеж взят.';
      play('playCorrect');
      after(900, function () {
        if (state.screen !== 'duels') return;
        if (state.duelIdx < state.quest.duels.length - 1) {
          state.duelIdx++;
          saveProgress();
          renderDuel();
        } else {
          finishStage();
        }
      });
      return;
    }

    var alive = loseLife('Поражение в дуэли против ' + duel.name);
    if (log) log.textContent = outcome === 'draw' ? 'Ничья. Рубеж не зачтён.' : 'Поражение. Рубеж не зачтён.';
    if (alive && btn) {
      btn.disabled = false;
      btn.textContent = 'Повторить дуэль';
    }
  }

  /* ==========================================================
     VII. ФИНАЛ: LICHESS
     ========================================================== */
  function renderFinal() {
    state.screen = 'final';
    var q = state.quest;

    setBody(
      chapter(CONFIG.route[4].num, CONFIG.route[4].title, 'Последний рубеж') +
      '<div class="tmq-boss">' +
        '<div class="tmq-boss-orb">♚</div>' +
        '<div><div class="tmq-title">Хранитель времени</div>' +
        '<div class="tmq-sub">бот ' + esc(CONFIG.botName) + ' · Lichess</div></div>' +
      '</div>' +
      '<div class="tmq-story"><p>«Ты прошёл память, атаку, защиту и пятерых хранителей эпох. Осталась партия. Садись — часы уже идут».</p></div>' +
      '<div class="tmq-step"><div class="tmq-step-title">Шаг 1 · профиль бота</div>' +
        '<a class="tmq-btn tmq-btn-cyan" href="' + esc(CONFIG.botUrl) + '" target="_blank" rel="noopener">@' +
        esc(CONFIG.botName) + ' на Lichess ↗</a></div>' +
      '<div class="tmq-step"><div class="tmq-step-title">Шаг 2 · контроль времени</div>' +
        '<select class="tmq-select" id="tmq-tc">' +
          '<option value="5+3">5 + 3 · блиц</option>' +
          '<option value="10+5" selected>10 + 5 · рапид</option>' +
          '<option value="15+10">15 + 10 · классика</option>' +
        '</select></div>' +
      '<div class="tmq-step"><div class="tmq-step-title">Шаг 3 · ник и грамота</div>' +
        '<input class="tmq-input" type="text" id="tmq-nick" placeholder="Ваш ник на Lichess" autocomplete="off">' +
        '<div class="tmq-err" id="tmq-nick-err" hidden>Ник должен быть не короче 3 символов.</div>' +
        '<button class="tmq-btn" type="button" id="tmq-verify">Получить грамоту</button></div>' +
      '<div class="tmq-hintline">Первые три участника, завершившие партию и показавшие грамоту судье, получают суперприз.</div>'
    );

    var input = dom.body.querySelector('#tmq-nick');
    var err = dom.body.querySelector('#tmq-nick-err');
    var select = dom.body.querySelector('#tmq-tc');

    function verify() {
      var value = input.value.trim();
      if (value.length < 3) {
        err.hidden = false;
        input.focus();
        return;
      }
      err.hidden = true;
      state.nick = value;
      state.tc = select.value;
      renderVictory();
    }

    dom.body.querySelector('#tmq-verify').addEventListener('click', verify);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') verify();
    });
  }

  function renderVictory() {
    state.screen = 'victory';
    play('playFanfare');

    var q = state.quest;
    var time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    state.code = 'QT-' + rand(1000, 9999) + '-' + String(q.id).toUpperCase().slice(0, 3);

    var certificate = [
      'ГРАМОТА ФИНАЛИСТА ТУРНИРА «МАШИНА ВРЕМЕНИ»',
      'Чемпион: ' + q.name,
      'Игрок: ' + state.nick,
      'Партия с ботом: ' + CONFIG.botName + ', контроль ' + state.tc,
      'Время финиша: ' + time,
      'Код верификации: ' + state.code,
      'Остаток жизней: ' + state.lives + ' из ' + CONFIG.maxLives,
      'Даты турнира: ' + CONFIG.dates
    ].join('\n');

    setBody(
      '<div class="tmq-crown">ПУТЬ ПРОЙДЕН</div>' +
      '<div class="tmq-title">' + esc(q.name) + ' пройден</div>' +
      '<div class="tmq-sub">Пять этапов и партия с Хранителем</div>' +
      '<div class="tmq-seal">' +
        '<div class="tmq-seal-title">Грамота финалиста · топ-3</div>' +
        '<div class="tmq-seal-name">' + esc(q.name) + '</div>' +
        '<div class="tmq-seal-line">Игрок: ' + esc(state.nick) + '<br>Контроль: ' + esc(state.tc) +
          ' · бот ' + esc(CONFIG.botName) + '</div>' +
        '<div class="tmq-seal-code">' + state.code + '</div>' +
        '<div class="tmq-seal-sub">Финиш ' + time + ' · жизни ' + state.lives + '/' + CONFIG.maxLives +
          ' · ' + esc(CONFIG.dates) + '</div>' +
      '</div>' +
      '<button class="tmq-btn tmq-btn-ghost" type="button" id="tmq-download">Скачать грамоту</button>' +
      '<button class="tmq-btn" type="button" id="tmq-finish">К карточке</button>'
    );

    dom.body.querySelector('#tmq-download').addEventListener('click', function () {
      var blob = new Blob([certificate], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'gramota-' + q.id + '.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    dom.body.querySelector('#tmq-finish').addEventListener('click', function () {
      var numericId = heroNumericId(state.hero);
      if (numericId !== null) {
        if (typeof registerCardDiscovery === 'function') registerCardDiscovery(numericId);
        if (typeof registerTestPassed === 'function') registerTestPassed(numericId);
      }
      close();
    });
  }

  /* ==========================================================
     VIII. ЗАВЕРШЕНИЕ ЭТАПА / ВЫБЫВАНИЕ
     ========================================================== */
  function finishStage() {
    var next = state.stage + 1;
    state.stage = Math.min(CONFIG.route.length, next);
    state.step = 0;
    state.answered = false;
    state.chosen = null;
    state.missed = false;
    saveProgress();
    play('playFanfare');
    renderMap(false);
  }

  function renderGameOver(reason) {
    state.screen = 'gameover';
    play('playDamageTaken');

    setBody(
      '<div class="tmq-crown tmq-crown-red">ПУТЬ ПРЕРВАН</div>' +
      '<div class="tmq-title">Жизни закончились</div>' +
      '<div class="tmq-sub">0 из ' + CONFIG.maxLives + '</div>' +
      '<div class="tmq-go-reason"><b>Причина:</b> ' + esc(reason) + '</div>' +
      '<div class="tmq-go-note">В турнирном режиме пересдачу открывает судья мастер-кодом. Здесь можно начать заново.</div>' +
      '<div class="tmq-step"><div class="tmq-step-title">Мастер-код судьи</div>' +
        '<input class="tmq-input" type="password" id="tmq-pin" placeholder="Код" autocomplete="off">' +
        '<div class="tmq-err" id="tmq-pin-err" hidden>Неверный код.</div>' +
        '<button class="tmq-btn" type="button" id="tmq-judge">Судейский сброс</button></div>' +
      '<button class="tmq-btn tmq-btn-ghost" type="button" id="tmq-close-go">Закрыть</button>'
    );

    var pin = dom.body.querySelector('#tmq-pin');
    var err = dom.body.querySelector('#tmq-pin-err');

    dom.body.querySelector('#tmq-judge').addEventListener('click', function () {
      if (pin.value.trim() !== CONFIG.judgeCode) {
        err.hidden = false;
        pin.focus();
        return;
      }
      err.hidden = true;
      try { localStorage.removeItem(storageKey()); } catch (e) {}
      state.lives = CONFIG.maxLives;
      state.stage = 0;
      state.step = 0;
      state.duelIdx = 0;
      play('playUltimate');
      renderMap(false);
    });

    dom.body.querySelector('#tmq-close-go').addEventListener('click', close);
  }

  /* ==========================================================
     API
     ========================================================== */
  function open(heroId) {
    ensureDOM();

    var quest = resolveQuest(heroId);
    if (!quest) {
      console.warn('[TimeMachineQuest] нет данных квеста для карточки:', heroId);
      if (typeof showDuelNotice === 'function') showDuelNotice('Для этой карточки квест ещё не настроен');
      return false;
    }

    state.heroId = quest.id;
    state.hero = (typeof HEROES !== 'undefined' && HEROES) ? (HEROES[heroId] || HEROES[String(heroId)]) : null;
    state.quest = quest;
    state.stage = 0;
    state.step = 0;
    state.duelIdx = 0;
    state.lives = CONFIG.maxLives;
    state.nick = '';
    state.tc = '10+5';
    state.busy = false;
    state.inBattle = false;
    state.answered = false;
    state.chosen = null;
    state.missed = false;
    clearTimers();

    var saved = loadProgress();
    if (saved) {
      if (typeof saved.lives === 'number' && saved.lives >= 0) state.lives = saved.lives;
      if (typeof saved.stage === 'number') state.stage = Math.min(saved.stage, CONFIG.route.length);
      if (typeof saved.step === 'number') state.step = Math.max(0, saved.step);
      if (typeof saved.duelIdx === 'number') state.duelIdx = Math.max(0, Math.min(saved.duelIdx, quest.duels.length - 1));
    }

    dom.overlay.classList.add('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'false');
    dom.epoch.textContent = quest.era + ' · ' + quest.name;

    unlockAudio();

    if (state.lives <= 0) {
      renderGameOver('Лимит ошибок исчерпан в предыдущей попытке');
    } else if (state.stage > 0) {
      renderMap(false);
    } else {
      renderGreet();
      play('playUltimate');
    }
    return true;
  }

  function close() {
    if (!dom) return;
    clearTimers();
    dom.overlay.classList.remove('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'true');
    state.inBattle = false;
    if (typeof stopAllTargetVideosImmediate === 'function') stopAllTargetVideosImmediate();
  }

  window.TimeMachineQuest = {
    open: open,
    start: open,
    close: close,
    config: CONFIG,
    state: state
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