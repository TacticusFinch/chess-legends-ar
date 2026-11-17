/* ==========================================================
   МАШИНА ВРЕМЕНИ — КВЕСТ (21–22 ноября)
   Классический скрипт, без import/export. Сам создаёт свой DOM.

   ВЕРСИЯ 3:
   · 10 жизней
   · глава-загадка убрана (модули quest-*.js больше не нужны)
   · в окне «Дверь открыта» — квантовая голограмма фигуры
     (js/quantum-figure.js, класс QuantumFigure)

   Структура: хаб из пяти глав вокруг портрета чемпиона.
   I Пролог → II Дверь → III Испытания → IV Хранители → V Хранитель времени

   ДУЭЛИ: настоящий NetDuel — тот же, что по кнопке «Дуэль».
   Требуется NetDuel.startQuestDuel({playerId, enemyId, onEnd}).

   API:
     TimeMachineQuest.open(heroId)
     TimeMachineQuest.start(heroId)  — алиас
     TimeMachineQuest.close()
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = {
    title: 'Машина времени',
    dates: '21–22 ноября',
    botName: 'TimeKeeperBot',
    botUrl: 'https://lichess.org/@/TimeKeeperBot',
    judgeCode: '2026',
    maxLives: 10,
    storagePrefix: 'chrono_quest_',
    greeting: {
      hello: 'Приветствую тебя, странник!',
      lead: 'Турнир «Машина времени»',
      text: 'Ты оживил карточку чемпиона — и она стала дверью в его эпоху. Впереди пять глав: память чемпиона, пять хранителей и партия с Хранителем времени. На весь путь десять жизней.',
      question: 'Готов выйти в путь?'
    },
    jumpSteps: [
      'Калибровка хронометра…',
      'Дверь открыта: {era}',
      'Чемпион {hero} выходит на связь…',
      'Архив закрыт — ключи соберём в пути.'
    ],
    route: [
      { key: 'greet', num: 'I', title: 'Пролог', note: 'Разлом открыт' },
      { key: 'jump', num: 'II', title: 'Дверь', note: 'Переход в эпоху' },
      { key: 'quiz', num: 'III', title: 'Испытания', note: 'Пять фактов' },
      { key: 'duels', num: 'IV', title: 'Хранители', note: 'Пять рубежей' },
      { key: 'final', num: 'V', title: 'Хранитель', note: 'Партия на Lichess' }
    ]
  };

  /* какая фигура материализуется для каждой карточки */
  var PIECE_BY_HERO = {
    steinitz: 'rook',
    lasker: 'queen',
    capablanca: 'king',
    alekhine: 'bishop',
    euwe: 'pawn',
    botvinnik: 'rook',
    smyslov: 'queen',
    tal: 'king',
    petrosyan: 'bishop',
    spassky: 'queen',
    fischer: 'king',
    karpov: 'rook',
    anand: 'bishop',
    liren: 'queen',
    gukesh: 'king',
    stockfish: 'rook',
    enigma: 'bishop',
    kasparov: 'queen',
    carlsen: 'king'
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
    rift: null,
    telTimer: null,
    shuffled: {}
  };

  var dom = null;

  /* ---------------- звук ---------------- */
  var SoundKit = (function () {
    var ctx = null;
    var master = null;

    function init() {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.45;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }

    function noise(dur) {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    function tone(o) {
      var c = init();
      if (!c) return;
      var t0 = c.currentTime + (o.delay || 0);
      var dur = o.dur || 0.4;
      var osc = c.createOscillator();
      var g = c.createGain();

      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.15, t0 + (o.attack || 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    }

    function sweep(o) {
      var c = init();
      if (!c) return;
      var t0 = c.currentTime + (o.delay || 0);
      var dur = o.dur || 0.7;

      var src = c.createBufferSource();
      src.buffer = noise(dur);

      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = o.q || 1.1;
      bp.frequency.setValueAtTime(o.from || 300, t0);
      bp.frequency.exponentialRampToValueAtTime(o.to || 2400, t0 + dur);

      var g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(o.gain || 0.12, t0 + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      src.connect(bp);
      bp.connect(g);
      g.connect(master);
      src.start(t0);
      src.stop(t0 + dur);
    }

    return {
      init: init,

      warp: function () {
        init();
        tone({ freq: 68, to: 132, dur: 1.2, gain: 0.2 });
        sweep({ from: 220, to: 2600, dur: 0.95, gain: 0.09 });
        tone({ freq: 523.25, dur: 1.0, gain: 0.05, delay: 0.6 });
      },

      step: function () {
        init();
        tone({ freq: 880, to: 640, dur: 0.14, gain: 0.06 });
        sweep({ from: 1800, to: 900, dur: 0.12, gain: 0.025 });
      },

      correct: function () {
        init();
        [523.25, 659.25, 783.99].forEach(function (f, i) {
          tone({ freq: f, dur: 0.55, gain: 0.09, delay: i * 0.07 });
        });
      },

      wrong: function () {
        init();
        tone({ freq: 150, to: 72, dur: 0.38, gain: 0.18 });
        sweep({ from: 520, to: 130, dur: 0.32, gain: 0.04 });
      },

      fanfare: function () {
        init();
        [392, 523.25, 659.25, 783.99].forEach(function (f, i) {
          tone({ freq: f, dur: 0.95, gain: 0.08, delay: i * 0.13 });
        });
      }
    };
  })();

  function unlockAudio() {
    try {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx.init === 'function') sfx.init();
      SoundKit.init();
    } catch (e) {}
  }

  var SOUND_MAP = {
    playUltimate: 'warp',
    playMove: 'step',
    playCorrect: 'correct',
    playWrong: 'wrong',
    playFanfare: 'fanfare',
    playShield: 'correct',
    playAttackHit: 'wrong',
    playDamageTaken: 'wrong',
    playBattleStart: 'warp'
  };

  function play(name) {
    try {
      unlockAudio();
      var key = SOUND_MAP[name] || name;
      if (typeof SoundKit[key] === 'function') {
        SoundKit[key]();
        return;
      }
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
      mission: quest.mission || 'Пройти пять глав пути и выстоять в партии с Хранителем времени.',
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
      '    <button class="tm-close" type="button" id="tm-close" aria-label="Закрыть квест">✕</button>',
      '  </header>',
      '  <div class="tm-body" id="tm-body"></div>',
      '</div>'
    ].join('\n');

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      body: overlay.querySelector('#tm-body'),
      lives: overlay.querySelector('#tm-lives'),
      epoch: overlay.querySelector('#tm-epoch'),
      closeBtn: overlay.querySelector('#tm-close')
    };

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
  function setStage(stage) {
    state.stage = stage;
    stopRift();
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

  function chapterHead(stageKey, noteOverride) {
    var item = routeItem(stageKey);
    if (!item) return '';
    return [
      '<div class="tm-chapter">',
      '  <span class="tm-chapter-num">' + item.num + '</span>',
      '  <span class="tm-chapter-title">' + esc(item.title) + '</span>',
      '  <span class="tm-chapter-note">' + esc(noteOverride || item.note) + '</span>',
      '</div>'
    ].join('\n');
  }

  /* ---------------- РАЗЛОМ + КВАНТОВАЯ ФИГУРА ---------------- */
  function renderRift() {
    return [
      '<div class="tm-rift">',
      '  <canvas class="tm-rift-canvas" id="tm-rift-canvas"></canvas>',
      '  <div class="tm-telemetry" aria-hidden="true">',
      '    <span class="tm-tel tm-tel-s1" data-slot="1"></span>',
      '    <span class="tm-tel tm-tel-s2" data-slot="2"></span>',
      '    <span class="tm-tel tm-tel-s3" data-slot="3"></span>',
      '    <span class="tm-tel tm-tel-s4" data-slot="4"></span>',
      '    <span class="tm-tel tm-tel-s5" data-slot="5"></span>',
      '    <span class="tm-tel tm-tel-s6" data-slot="6"></span>',
      '  </div>',
      '</div>',
      '<div class="tm-figure-cap" id="tm-figure-cap">материализация фигуры</div>'
    ].join('\n');
  }

  function stopRift() {
    if (state.rift) {
      if (typeof state.rift.destroy === 'function') state.rift.destroy();
      else if (typeof state.rift.stop === 'function') state.rift.stop();
      state.rift = null;
    }
    if (state.telTimer) {
      clearInterval(state.telTimer);
      state.telTimer = null;
    }
  }

  var TEL_MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'd4', 'c5', 'c3', 'Nf6'];

  function startTelemetry() {
    var slots = dom.body.querySelectorAll('[data-slot]');
    if (!slots.length) return;

    var HOLD_MIN = 1500;
    var HOLD_MAX = 2400;
    var FADE = 600;

    function readout() {
      var kind = Math.floor(Math.random() * 5);

      if (kind === 0) return 'ΔT ' + (Math.random() * 0.009).toFixed(4);
      if (kind === 1) return 'PHASE ' + String(Math.floor(Math.random() * 99)).padStart(2, '0');
      if (kind === 2) return 'ENT ' + Math.random().toFixed(3);
      if (kind === 3) return 'Q ' + String(Math.floor(Math.random() * 9999)).padStart(4, '0');

      return TEL_MOVES[Math.floor(Math.random() * TEL_MOVES.length)] + ' ' +
        TEL_MOVES[Math.floor(Math.random() * TEL_MOVES.length)];
    }

    function show(slot) {
      slot.dataset.busy = '1';
      slot.textContent = readout();
      slot.classList.add('is-on');

      var hold = HOLD_MIN + Math.random() * (HOLD_MAX - HOLD_MIN);

      var hideId = setTimeout(function () {
        slot.classList.remove('is-on');

        var clearId = setTimeout(function () {
          slot.textContent = '';
          delete slot.dataset.busy;
        }, FADE);

        state.timers.push(clearId);
      }, hold);

      state.timers.push(hideId);
    }

    state.telTimer = setInterval(function () {
      var free = [];

      Array.prototype.forEach.call(slots, function (slot) {
        if (!slot.dataset.busy) free.push(slot);
      });

      if (!free.length) return;

      show(free[Math.floor(Math.random() * free.length)]);
    }, 620);
  }

  function figureKeyForQuest() {
    var id = (state.quest && state.quest.id) ? String(state.quest.id) : '';
    return PIECE_BY_HERO[id] || 'king';
  }

  function mountRift() {
    stopRift();

    var canvas = dom.body.querySelector('#tm-rift-canvas');
    if (!canvas) return;

    var piece = figureKeyForQuest();
    var cap = dom.body.querySelector('#tm-figure-cap');
    var labels = (typeof QuantumFigure !== 'undefined' && QuantumFigure.PIECES) ? QuantumFigure.PIECES : null;

    if (cap) {
      cap.textContent = 'голограмма: ' + (labels ? (labels[piece] || piece) : piece);
    }

    /* основной путь: квантовая голограмма (рисует и разлом, и фигуру) */
    if (typeof QuantumFigure !== 'undefined') {
      state.rift = new QuantumFigure(canvas, { piece: piece });

      var drag = false;
      canvas.addEventListener('pointerdown', function (e) {
        if (canvas.setPointerCapture) {
          try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        }
        drag = true;
        state.rift.beginDrag(e.clientX);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (drag) state.rift.dragTo(e.clientX);
      });
      var endDrag = function () {
        drag = false;
        state.rift.endDrag();
      };
      canvas.addEventListener('pointerup', endDrag);
      canvas.addEventListener('pointercancel', endDrag);
      canvas.addEventListener('pointerleave', endDrag);

      state.rift.start();
      startTelemetry();
      return;
    }

    /* запасной путь: старый плоский разлом */
    if (typeof QuantumRift !== 'undefined') {
      state.rift = new QuantumRift(canvas, {
        color: '53, 214, 240',
        color2: '168, 224, 95'
      });
      state.rift.start();
      startTelemetry();
      return;
    }

    if (cap) cap.textContent = 'графика не загружена';
    console.warn('[TimeMachineQuest] нет ни QuantumFigure, ни QuantumRift — подключите js/quantum-figure.js');
  }

  /* ---------------- I. ПРОЛОГ ---------------- */
  function renderGreeting() {
    setStage('greet');
    renderLives(false);
    var quest = state.quest;
    var hero = state.hero || {};
    var g = CONFIG.greeting;
    var rankName = (hero.rank && hero.rank.name) ? hero.rank.name : 'ЛЕГЕНДА';
    var portrait = hero.avatar
      ? '<img src="' + esc(hero.avatar) + '" alt="' + esc(quest.name) + '" onerror="this.style.display=\'none\'">'
      : '<span>' + esc(quest.piece) + '</span>';

    dom.body.innerHTML = [
      chapterHead('greet', quest.era),
      '<div class="tm-greet">',
      '  <div class="tm-hero-line">',
      '    <div class="tm-hero-portrait">' + portrait + '</div>',
      '    <div class="tm-hero-meta">',
      '      <div class="tm-hero-name">' + esc(quest.name) + '</div>',
      '      <div class="tm-hero-era">' + esc(quest.era) + '</div>',
      '      <div class="tm-rank-chip">' + esc(rankName) + '</div>',
      '    </div>',
      '  </div>',
      '  <div>',
      '    <div class="tm-greet-hello">' + esc(g.hello) + '</div>',
      '    <div class="tm-greet-lead">' + esc(g.lead) + '</div>',
      '  </div>',
      '  <div class="tm-story"><p>' + esc(g.text) + '</p></div>',
      '  <div class="tm-greet-question">' + esc(g.question) + '</div>',
      '  <div class="tm-actions-row">',
      '    <button class="tm-btn tm-btn-ghost" type="button" id="tm-bio-btn">Биография</button>',
      '    <button class="tm-btn" type="button" id="tm-ready-btn">В путь</button>',
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
        return '<p><strong>' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>';
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

  /* ---------------- II. ДВЕРЬ ---------------- */
  function renderJump() {
    setStage('jump');
    var quest = state.quest;
    var steps = CONFIG.jumpSteps.map(function (line) {
      return line.replace('{hero}', quest.name).replace('{era}', quest.era);
    });

    dom.body.innerHTML = [
      chapterHead('jump', quest.era),
      '<div class="tm-jump">',
      '  <div>',
      '    <div class="tm-title">Дверь открыта</div>',
      '    <div class="tm-sub">' + esc(quest.era) + '</div>',
      '  </div>',
      renderRift(),
      '  <div class="jump-steps" id="tm-jump-steps">',
      steps.map(function (line, i) {
        return '<div class="jump-step" data-step="' + i + '"><span class="mark">›</span><span>' + esc(line) + '</span></div>';
      }).join(''),
      '  </div>',
      '  <div class="tm-figure-actions">',
      '    <button class="tm-btn tm-btn-ghost" type="button" id="tm-rematerialize">Пересобрать</button>',
      '    <button class="tm-btn" type="button" id="tm-jump-next" hidden>Дальше</button>',
      '  </div>',
      '</div>'
    ].join('\n');

    mountRift();

    var nodes = dom.body.querySelectorAll('.jump-step');
    var next = dom.body.querySelector('#tm-jump-next');
    var again = dom.body.querySelector('#tm-rematerialize');

    Array.prototype.forEach.call(nodes, function (node, i) {
      after(320 + i * 780, function () {
        node.classList.add('is-on');
        play('playMove');
      });
    });

    after(320 + nodes.length * 780, function () {
      next.hidden = false;
    });

    if (again) {
      again.addEventListener('click', function () {
        if (state.rift && typeof state.rift.reassemble === 'function') {
          state.rift.reassemble();
          play('playMove');
        }
      });
    }

    next.addEventListener('click', renderChallenge);
  }

  /* брифинг */
  function renderChallenge() {
    setStage('jump');
    var quizCount = state.quest.quiz.length;
    var duelCount = state.quest.duels.length;

    var cards = [
      { icon: '01', title: quizCount + ' вопросов о чемпионе', text: 'Факты из биографии. Ошибка — минус жизнь, вопрос можно переиграть.' },
      { icon: '02', title: duelCount + ' дуэлей с хранителями', text: 'Арена, карточки, тактическая доска и 30 секунд на ход — как в обычной дуэли.' },
      { icon: '03', title: 'Хранитель времени', text: 'Партия с ботом турнира на Lichess. Первые трое финалистов получают суперприз.' }
    ];

    dom.body.innerHTML = [
      '<div class="tm-stage-head">',
      '  <span class="tm-badge tm-badge-gold">Снаряжение</span>',
      '  <span class="tm-counter">' + CONFIG.maxLives + ' жизней</span>',
      '</div>',
      '<div class="tm-title">Что впереди</div>',
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
    setStage('quiz');
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
      chapterHead('quiz', (state.quizIdx + 1) + ' / ' + total),
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

        fb.innerHTML = '<b>Неверно.</b> Осталось ' + state.lives + ' из ' + CONFIG.maxLives +
          '.<br>' + esc(opt.comment) + '<br><span class="tm-hintline">Попробуйте снова.</span>';

        after(1800, function () {
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
    setStage('duels');
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
      chapterHead('duels', 'Рубеж ' + (state.duelIdx + 1) + ' / ' + total),
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
      '  <div class="tm-log" id="tm-duel-log">Дуэль идёт на арене: карточки, 50 HP, тактическая доска и 30 секунд на ход.</div>',
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
      if (log) log.textContent = 'NetDuel не найден: подключите js/net-duel.js с патчем startQuestDuel.';
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
      var logEl = dom.body.querySelector('#tm-duel-log');
      if (logEl) logEl.textContent = 'Не удалось начать дуэль: наведите камеру на карточку чемпиона.';
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
        ? 'Ничья. Рубеж не зачтён.'
        : 'Поражение. Рубеж не зачтён.';
    }
    if (alive && btn) {
      btn.disabled = false;
      btn.textContent = 'Повторить дуэль';
    }
  }

  /* ---------------- V. ХРАНИТЕЛЬ ВРЕМЕНИ ---------------- */
  function renderFinal() {
    setStage('final');

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
      '    <p class="tm-mission">Первые три участника, завершившие партию и показавшие грамоту судье, получают суперприз.</p>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 1 · профиль бота</div>',
      '    <a class="tm-btn tm-btn-cyan" href="' + esc(CONFIG.botUrl) + '" target="_blank" rel="noopener">@' +
        esc(CONFIG.botName) + ' на Lichess</a>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 2 · контроль времени</div>',
      '    <select class="tm-select" id="tm-tc">',
      '      <option value="5+3">5 + 3 · блиц</option>',
      '      <option value="10+5" selected>10 + 5 · рапид</option>',
      '      <option value="15+10">15 + 10 · классика</option>',
      '    </select>',
      '  </div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Шаг 3 · результат</div>',
      '    <input class="tm-input" type="text" id="tm-nick" placeholder="Ник на Lichess" autocomplete="off">',
      '    <div class="tm-err" id="tm-nick-err" hidden>Введите ник (минимум 3 символа).</div>',
      '    <button class="tm-btn" type="button" id="tm-verify">Получить грамоту</button>',
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
    setStage('victory');
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
      '    <div class="tm-sub">Пять глав и партия с Хранителем</div>',
      '  </div>',
      '  <div class="tm-seal">',
      '    <div class="tm-seal-title">Грамота финалиста · топ-3</div>',
      '    <div class="tm-seal-champ">' + esc(quest.name) + '</div>',
      '    <div class="tm-seal-line">Игрок: ' + esc(state.nick) + '<br>Контроль: ' + esc(state.timeControl) + '</div>',
      '    <div class="tm-seal-code">' + code + '</div>',
      '    <div class="tm-seal-sub">Финиш ' + time + ' · жизни ' + state.lives + '/' + CONFIG.maxLives +
        ' · ' + esc(CONFIG.dates) + '</div>',
      '  </div>',
      '  <button class="tm-btn tm-btn-ghost" type="button" id="tm-download">Скачать грамоту</button>',
      '  <button class="tm-btn" type="button" id="tm-finish">К карточке</button>',
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
    play('playDamageTaken');

    dom.body.innerHTML = [
      '<div class="tm-gameover">',
      '  <div class="tm-go-icon">ПУТЬ ПРЕРВАН</div>',
      '  <div>',
      '    <div class="tm-title tm-title-red">Выбывание из конкурса</div>',
      '    <div class="tm-sub">Жизни закончились · 0 из ' + CONFIG.maxLives + '</div>',
      '  </div>',
      '  <div class="tm-go-reason"><b>Причина:</b> ' + esc(reason) + '</div>',
      '  <div class="tm-go-note">Прохождение карточки в турнирном режиме остановлено. Биография и свободные дуэли остаются доступны. Пересдачу открывает судья мастер-кодом.</div>',
      '  <div class="tm-step">',
      '    <div class="tm-step-title">Мастер-код судьи</div>',
      '    <input class="tm-input" type="password" id="tm-pin" placeholder="Код" autocomplete="off">',
      '    <div class="tm-err" id="tm-pin-err" hidden>Неверный код.</div>',
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
    dom.epoch.textContent = quest.era + ' · ' + quest.name;

    unlockAudio();
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
    stopRift();
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