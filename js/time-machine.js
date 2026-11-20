/* ==========================================================
   МАШИНА ВРЕМЕНИ — ДВИЖОК КВЕСТА (v14, классический скрипт)

   Здесь только логика. Все тексты — вопросы, биографии,
   прологи, истории соперников, реплики — лежат в js/quest-data.js
   и читаются через window.QUEST_*:

     QUEST_DATA[hero]      вопросы, задачи, миссия
     QUEST_QUIZ[hero]      вопросы уровня I
     QUEST_BIO[hero]       биография для чтения
     QUEST_PROLOGUE        пролог чемпиона
     QUEST_BEATS           реплики после нажатий
     QUEST_RIVAL_LORE      фраза, история и факт соперника
     QUEST_RIVAL_TAUNTS    реплики, когда игрок проиграл
     QUEST_RIVAL_LOSS      реплики, когда соперник проиграл

   Звук — js/sound.js (sfx). Здесь только обёртка play().

   Задачи уровней II–III берутся из QUEST_DATA[hero].attack/.defense,
   затем из window.QUEST_PUZZLES, затем из DUEL_STRIKE_PUZZLES /
   DUEL_DEFENSE_PUZZLES (js/duel-puzzles.js). Каждая проверяется
   на легальность хода, поэтому битые позиции отсеиваются.

   Доска — chessboard.js + chess.js. Если их нет, включается
   встроенная CSS-доска, поэтому квест не ломается.

   API: TimeMachineQuest.start(heroId) / .openBio(heroId) / .close()
        TimeMachineQuest.tauntFor(name) — реплика соперника
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = {
    dates: '21–22 ноября',
    botName: 'Watson-bot',
    botUrl: 'https://lichess.org/@/Watson-bot',
    maxLives: 10,
    quizCount: 10,
    puzzleCount: 5,
    storagePrefix: 'tmq_v8_',
    judgeCode: '2026',
    winPhrase: 'вечный шах',
    timekeeperAvatar: './assets/avatars/timekeeper.png',
    avatarDir: './assets/avatars/',
    pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
    synopsis: 'Карточка ожила — и время треснуло. Чтобы вернуть корону, ты пройдёшь пять кругов: вспомнишь, кем был чемпион до славы; разбудишь его удар; научишься видеть угрозу раньше, чем она родится; сойдёшься с пятью хранителями эпох; и сядешь за доску с тем, кто считает время своим. Каждый круг — не экзамен, а дорога, которую чемпион прошёл сам. Пройдёшь её ты — и корона признает нового хозяина.',
    route: [
      {
        key: 'quiz', num: 'I', title: 'Вспомнить всё', sub: 'Биография до чемпионства', glyph: '❖',
        text: '',
        why: 'Память. Пока ты не знаешь, из какого города он вышел и кого победил, его сила останется чужой. Здесь ты собираешь человека по кусочкам — и он начинает тебе доверять.',
        brief: [
          ['Что будет', 'Викторина о биографии чемпиона. Ты внимательно её изучил?'],
          ['Как отвечать', 'Выберите один вариант. Верный ответ ведёт дальше, неверный отнимает жизнь.']
        ]
      },
      {
        key: 'attack', num: 'II', title: 'Пробуждение силы', sub: 'Задачи на атаку', glyph: '⚔',
        text: '',
        why: 'Сила не приходит из ниоткуда. Чемпион годами учился видеть последнюю горизонталь, слабое поле и открытую линию — и теперь эта способность просыпается в тебе. Рука уже помнит вес фигуры. Осталось найти тот самый ход: не самый красивый, а тот, после которого сопернику нечем ответить.',
        brief: [
          ['Что будет', 'Шахматные задачи на атакующую тактику.'],
          ['Как играть', 'Нажмите фигуру — подсветятся её ходы. Затем нажмите поле.']
        ]
      },
      {
        key: 'defense', num: 'III', title: 'Скрытая угроза', sub: 'Задачи на защиту', glyph: '⛨',
        text: '',
        why: 'Оборона. Побеждает не тот, кто громче атакует, а тот, кто первым замечает опасность. Здесь тебе уже грозят матом, а в запасе один ход. Научишься — не потеряешь корону в настоящей партии.',
        brief: [
          ['Что будет', 'Шахматные задачи на нахождение защитного хода.'],
          ['Как играть', 'Нажмите фигуру — подсветятся её ходы. Затем нажмите поле.']
        ]
      },
      {
        key: 'duels', num: 'IV', title: 'Пять поединков', sub: 'Соперники эпохи', glyph: '♞',
        text: '',
        why: 'Круг. Пять человек, с которыми чемпион действительно садился за доску. Один давит, другой ждёт, третий жертвует всё. Здесь ты примеряешь его характер и понимаешь, чем на самом деле берутся короны.',
        brief: []
      },
      {
        key: 'final', num: 'V', title: 'Финальная схватка', sub: 'Хранитель времени', glyph: '♚',
        text: 'Последний рубеж — партия с ботом турнира и грамота финалиста.',
        why: 'Финал. Хранитель времени — не человек, а сама эпоха. Он не проигрывает по правилам: он проигрывает тому, кто не отступил.',
        brief: [
          ['Что будет', 'Партия с ботом турнира на Lichess.'],
          ['Как играть', 'Выберите контроль времени, укажите ник, получите грамоту.']
        ]
      }
    ]
  };

  /* ==========================================================
     ЗВУК: только обёртка над js/sound.js
     ========================================================== */
  var SOUND_ALIAS = {
    click: 'click',
    step: 'playMove',
    playMove: 'playMove',
    playCorrect: 'playCorrect',
    correct: 'playCorrect',
    playWrong: 'playWrong',
    wrong: 'playWrong',
    playFanfare: 'playFanfare',
    playCheckmate: 'playCheckmate',
    playBattleStart: 'playBattleStart',
    playDamageTaken: 'playDamageTaken',
    playDamageDealt: 'playDamageDealt',
    playAttackHit: 'playAttackHit',
    playCritHit: 'playCritHit',
    playShield: 'playShield',
    playUltimate: 'playUltimate',
    playCardUnlock: 'playCardUnlock',
    choir: 'choir',
    warp: 'warp',
    arrival: 'arrival',
    crystal: 'crystal',
    fanfareBig: 'questVictory',
    questVictory: 'questVictory',
    heroic: 'heroic'
  };

  function unlockAudio() {
    try {
      if (typeof sfx === 'undefined' || !sfx || typeof sfx.init !== 'function') return;
      if (!sfx.ctx) sfx.init();
      else if (sfx.ctx.state === 'suspended') sfx.ctx.resume();
    } catch (e) {}
  }

  function play(name) {
    try {
      if (typeof sfx === 'undefined' || !sfx) return;
      unlockAudio();
      var method = SOUND_ALIAS[name] || name;
      if (typeof sfx[method] !== 'function') return;
      if (sfx.enabled === false) return;
      sfx[method]();
    } catch (e) {}
  }

  /* ==========================================================
     СОСТОЯНИЕ
     ========================================================== */
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
    nick: '',
    tc: '10+5',
    code: '',
    busy: false,
    inBattle: false,
    battle: null,
    board: null,
    timers: [],
    pending: null
  };

  var dom = null;
  var nav = [];
  var storageOk = true;
  var lastBeatAt = 0;

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

  function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function shuffle(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function normalizeWord(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[^a-zа-я0-9]/g, '');
  }

  function checkWinWord(value) {
    var v = normalizeWord(value);
    if (!v) return false;
    return v === normalizeWord(CONFIG.winPhrase) || v === normalizeWord(CONFIG.judgeCode);
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

  function storageKey() { return CONFIG.storagePrefix + (state.heroId || 'unknown'); }

  function saveProgress() {
    if (!storageOk) return;
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        stage: state.stage, step: state.step, duelIdx: state.duelIdx, lives: state.lives
      }));
    } catch (e) { storageOk = false; }
  }

  function loadProgress() {
    if (!storageOk) return null;
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { storageOk = false; return null; }
  }

  function clearSaved() {
    if (!storageOk) return;
    try { localStorage.removeItem(storageKey()); } catch (e) { storageOk = false; }
  }

  function heroNumericId(hero) {
    if (!hero || typeof HEROES === 'undefined' || !HEROES) return null;
    var keys = Object.keys(HEROES);
    for (var i = 0; i < keys.length; i++) {
      var h = HEROES[keys[i]];
      if (h && String(h.id) === String(hero.id)) {
        var n = Number(keys[i]);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  /* ==========================================================
     АВАТАРЫ
     ========================================================== */
  var SHADOW_AVATAR = './assets/avatars/shadow.png';

  function avatarSrc(hero) {
    if (!hero) return '';
    if (hero.avatar) return hero.avatar;
    var id = String(hero.id || '').toLowerCase();
    if (!id) return '';
    return CONFIG.avatarDir + id + '.png';
  }

  function monogram(hero) {
    var name = (hero && hero.name) || '♞';
    var initials = String(name).split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0); }).slice(0, 2).join('');
    var color = (hero && hero.color) || '#d4b475';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">' +
      '<rect width="96" height="96" fill="#0a1018"/>' +
      '<circle cx="48" cy="48" r="41" fill="none" stroke="' + color + '" stroke-opacity="0.55" stroke-width="1.5"/>' +
      '<text x="48" y="46" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="' + color + '" fill-opacity="0.9">♞</text>' +
      '<text x="48" y="74" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="17" font-weight="700" fill="#e9f1f8">' + initials + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function avatarHtml(hero, cls) {
    var src = avatarSrc(hero);
    var name = esc((hero && hero.name) || 'Чемпион');
    var extra = /shadow\.png/i.test(src) ? ' is-shadow' : '';

    if (!src) {
      return '<span class="tmq-ava ' + (cls || '') + extra + '">' +
        '<img src="' + esc(monogram(hero)) + '" alt="Портрет: ' + name + '"></span>';
    }
    return '<span class="tmq-ava ' + (cls || '') + extra + '">' +
      '<img src="' + esc(src) + '" alt="Портрет: ' + name + '" loading="lazy" data-fallback="' + esc(monogram(hero)) + '">' +
      '</span>';
  }

  function bindAvatars(root) {
    if (!root || !root.querySelectorAll) return;
    var imgs = root.querySelectorAll('img[data-fallback]');
    Array.prototype.forEach.call(imgs, function (img) {
      function fallback() {
        if (img.getAttribute('data-failed') === '1') return;
        img.setAttribute('data-failed', '1');
        img.src = img.getAttribute('data-fallback');
        img.classList.add('is-mono');
      }
      img.addEventListener('error', fallback);
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  }

  /* ==========================================================
     РЕПЛИКИ
     ========================================================== */
  var BEATS = (window.QUEST_BEATS && typeof window.QUEST_BEATS === 'object')
    ? window.QUEST_BEATS
    : {};

  var BEATS_FALLBACK = {
    generic: [
      'Время шуршит страницей.',
      'Ты делаешь шаг — и эпоха делает шаг навстречу.',
      'Где-то далеко щёлкают часы. Это не твои часы.'
    ]
  };

  function beatText(key) {
    var list = BEATS[key];
    if (!list || !list.length) list = BEATS.generic || BEATS_FALLBACK.generic;
    var q = state.quest || {};
    var hero = state.hero || {};
    var name = q.name || hero.name || 'Чемпион';
    return String(pick(list))
      .replace(/\{name\}/g, name)
      .replace(/\{short\}/g, q.shortName || name);
  }

  function say(text) {
    if (!dom || !dom.beat || !text) return;
    lastBeatAt = Date.now();
    dom.beat.textContent = text;
    dom.beat.classList.remove('is-in');
    void dom.beat.offsetWidth;
    dom.beat.classList.add('is-in');
  }

  function beat(key) { say(beatText(key)); }

  /* ==========================================================
     ШАХМАТНЫЙ ДВИЖОК
     ========================================================== */
  var MiniChess = (function () {
    var FILES = 'abcdefgh';

    function parse(fen) {
      var board = {};
      var rows = String(fen).split(' ')[0].split('/');
      for (var r = 0; r < 8; r++) {
        var rank = 8 - r;
        var file = 0;
        var row = rows[r] || '8';
        for (var i = 0; i < row.length; i++) {
          var ch = row[i];
          if (ch >= '1' && ch <= '8') {
            file += Number(ch);
          } else {
            if (file < 8) board[FILES.charAt(file) + rank] = ch;
            file++;
          }
        }
      }
      var parts = String(fen).split(' ');
      return { board: board, turn: parts[1] === 'b' ? 'b' : 'w' };
    }

    function colorOf(p) { return p === p.toUpperCase() ? 'w' : 'b'; }
    function inside(f, r) { return f >= 0 && f < 8 && r >= 1 && r <= 8; }
    function sq(f, r) { return FILES.charAt(f) + r; }

    function push(out, from, f, r, board, me) {
      if (!inside(f, r)) return;
      var target = board[sq(f, r)];
      if (target && colorOf(target) === me) return;
      out.push({ from: from, to: sq(f, r), capture: !!target });
    }

    function moves(fen, from) {
      var pos = parse(fen);
      var board = pos.board;
      var piece = board[from];
      var out = [];
      if (!piece) return out;
      var me = colorOf(piece);
      var t = piece.toLowerCase();
      var f = FILES.indexOf(from.charAt(0));
      var r = Number(from.charAt(1));

      if (t === 'p') {
        var dir = me === 'w' ? 1 : -1;
        var startRank = me === 'w' ? 2 : 7;
        if (inside(f, r + dir) && !board[sq(f, r + dir)]) {
          out.push({ from: from, to: sq(f, r + dir), capture: false });
          if (r === startRank && !board[sq(f, r + 2 * dir)]) {
            out.push({ from: from, to: sq(f, r + 2 * dir), capture: false });
          }
        }
        [-1, 1].forEach(function (d) {
          var ff = f + d, rr = r + dir;
          if (!inside(ff, rr)) return;
          var target = board[sq(ff, rr)];
          if (target && colorOf(target) !== me) out.push({ from: from, to: sq(ff, rr), capture: true });
        });
        return out;
      }

      if (t === 'n') {
        [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
          .forEach(function (d) { push(out, from, f + d[0], r + d[1], board, me); });
        return out;
      }

      if (t === 'k') {
        [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
          .forEach(function (d) { push(out, from, f + d[0], r + d[1], board, me); });
        return out;
      }

      var dirs = [];
      if (t === 'r' || t === 'q') dirs = dirs.concat([[1, 0], [-1, 0], [0, 1], [0, -1]]);
      if (t === 'b' || t === 'q') dirs = dirs.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]);

      dirs.forEach(function (d) {
        var ff = f + d[0], rr = r + d[1];
        while (inside(ff, rr)) {
          var target = board[sq(ff, rr)];
          if (!target) {
            out.push({ from: from, to: sq(ff, rr), capture: false });
          } else {
            if (colorOf(target) !== me) out.push({ from: from, to: sq(ff, rr), capture: true });
            break;
          }
          ff += d[0];
          rr += d[1];
        }
      });
      return out;
    }

    function apply(fen, from, to) {
      var parts = String(fen).split(' ');
      var pos = parse(fen);
      var board = pos.board;
      var piece = board[from];
      if (!piece) return fen;
      delete board[from];
      board[to] = piece;
      if (piece === 'P' && to.charAt(1) === '8') board[to] = 'Q';
      if (piece === 'p' && to.charAt(1) === '1') board[to] = 'q';

      var rows = [];
      for (var r = 8; r >= 1; r--) {
        var row = '';
        var empty = 0;
        for (var f = 0; f < 8; f++) {
          var p = board[FILES.charAt(f) + r];
          if (p) {
            if (empty) { row += empty; empty = 0; }
            row += p;
          } else {
            empty++;
          }
        }
        if (empty) row += empty;
        rows.push(row);
      }
      parts[0] = rows.join('/');
      parts[1] = pos.turn === 'w' ? 'b' : 'w';
      return parts.join(' ');
    }

    return { parse: parse, moves: moves, apply: apply, colorOf: colorOf };
  })();

  var ChessJsAdapter = (function () {
    var Ctor = window.Chess;
    if (typeof Ctor !== 'function') return null;

    function game(fen) { return new Ctor(fen); }

    try {
      var probe = game('8/8/8/8/8/8/8/K6k w - - 0 1');
      if (!probe || typeof probe.moves !== 'function') return null;
    } catch (e) {
      return null;
    }

    return {
      parse: function (fen) {
        try {
          var g = game(fen);
          var rows = g.board();
          var out = {};
          for (var r = 0; r < 8; r++) {
            for (var f = 0; f < 8; f++) {
              var cell = rows[r][f];
              if (!cell) continue;
              var sq = 'abcdefgh'.charAt(f) + (8 - r);
              out[sq] = cell.color === 'w' ? String(cell.type).toUpperCase() : String(cell.type);
            }
          }
          return { board: out, turn: g.turn() };
        } catch (e) {
          return MiniChess.parse(fen);
        }
      },

      moves: function (fen, from) {
        try {
          var g = game(fen);
          var list = g.moves({ square: from, verbose: true }) || [];
          return list.map(function (m) {
            var flags = String(m.flags || '');
            return {
              from: m.from,
              to: m.to,
              capture: flags.indexOf('c') !== -1 || flags.indexOf('e') !== -1
            };
          });
        } catch (e) {
          return MiniChess.moves(fen, from);
        }
      },

      apply: function (fen, from, to) {
        try {
          var g = game(fen);
          var made = g.move({ from: from, to: to, promotion: 'q' });
          if (!made) return fen;
          return g.fen();
        } catch (e) {
          return MiniChess.apply(fen, from, to);
        }
      },

      colorOf: function (p) { return p === p.toUpperCase() ? 'w' : 'b'; }
    };
  })();

  var Chess = (typeof ChessLite !== 'undefined' && ChessLite && ChessLite.parse)
    ? ChessLite
    : (ChessJsAdapter || MiniChess);

  /* ==========================================================
     ДАННЫЕ
     ========================================================== */
  var DEFAULT_ATTACK = [
    {
      task: 'Мат в один ход. Найдите удар по последней горизонтали.',
      fen: '6k1/5ppp/8/8/8/8/5PPP/1R4K1 w - - 0 1',
      from: 'b1', to: 'b8',
      why: 'Лb8# — мат по последней горизонтали: пешки f7, g7 и h7 запирают собственного короля.'
    },
    {
      task: 'Мат в один ход. Накажите соперника за слабость поля f7.',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
      from: 'f3', to: 'f7',
      why: 'Фxf7# — мат: ферзя защищает слон c4, а королю некуда уйти.'
    }
  ];

  var DEFAULT_DEFENSE = [
    {
      task: 'Белые грозят матом на b8. Найдите защиту — сделайте «форточку» для короля.',
      fen: '6k1/5ppp/8/8/8/8/5PPP/1R4K1 b - - 0 1',
      from: 'h7', to: 'h6',
      why: '1...h6! — у короля появляется поле h7, и мат по последней горизонтали больше не страшен.'
    },
    {
      task: 'Чёрный конь объявил шах. Найдите лучшую защиту.',
      fen: '6k1/5ppp/8/8/8/5n2/5PPP/6K1 w - - 0 1',
      from: 'g2', to: 'f3',
      why: 'gxf3 — вы уничтожаете атакующего коня и остаётесь с лишней фигурой.'
    }
  ];

  function isSolvable(fen, from, to) {
    if (!fen || !from || !to) return false;
    try {
      var list = Chess.moves(fen, from);
      for (var i = 0; i < list.length; i++) {
        if (list[i].to === to) return true;
      }
    } catch (e) {}
    return false;
  }

  function pickPuzzles(pool, count) {
    var valid = [];
    for (var i = 0; i < pool.length; i++) {
      var p = pool[i];
      if (!p || !p.fen) continue;
      var mv = p.move || p;
      if (isSolvable(p.fen, mv.from, mv.to)) valid.push(p);
    }
    if (!valid.length) return [];
    return shuffle(valid).slice(0, count || CONFIG.puzzleCount);
  }

  function normalizePuzzle(p, kind) {
    var mv = p.move || p;
    var turn = String(p.fen).split(' ')[1] === 'b' ? 'чёрных' : 'белых';
    return {
      task: p.task || p.desc || ('Ход ' + turn + ': найдите сильнейший ход.'),
      fen: p.fen,
      from: mv.from,
      to: mv.to,
      why: p.why || (kind === 'defense'
        ? 'Именно этот ход снимает угрозу: позиция успокаивается, а соперник теряет темп.'
        : 'Точный удар решает партию сразу — соперник не успевает ответить.')
    };
  }

  function fromDuelPuzzles(kind, seed) {
    var custom = window.QUEST_PUZZLES && window.QUEST_PUZZLES[kind];
    if (custom && custom.length) {
      var chosen = pickPuzzles(custom, CONFIG.puzzleCount);
      if (chosen.length) {
        return chosen.map(function (p) { return normalizePuzzle(p, kind); });
      }
    }

    var pool = kind === 'defense'
      ? (typeof DUEL_DEFENSE_PUZZLES !== 'undefined' ? DUEL_DEFENSE_PUZZLES : null)
      : (typeof DUEL_STRIKE_PUZZLES !== 'undefined' ? DUEL_STRIKE_PUZZLES : null);

    if (pool && pool.length) {
      var picked = pickPuzzles(pool, CONFIG.puzzleCount);
      if (picked.length) {
        return picked.map(function (p) { return normalizePuzzle(p, kind); });
      }
    }

    return (kind === 'defense' ? DEFAULT_DEFENSE : DEFAULT_ATTACK).map(function (p) {
      return normalizePuzzle(p, kind);
    });
  }

  function isBiographyQuestion(item) {
    if (!item || !item.q || !item.options) return false;
    if (item.image) return false;
    var d = String(item.difficulty || '').toLowerCase();
    if (d.indexOf('тактик') !== -1) return false;
    var correct = 0;
    for (var i = 0; i < item.options.length; i++) {
      if (item.options[i] && item.options[i].correct) correct++;
    }
    return correct === 1;
  }

  function resolveQuiz(hero, data) {
    var custom = (window.QUEST_QUIZ && window.QUEST_QUIZ[hero.id]) || null;
    var pool = [];

    if (custom && custom.length) pool = custom.slice();
    else if (data.bioQuiz && data.bioQuiz.length) pool = data.bioQuiz.slice();
    else if (hero.puzzles && hero.puzzles.length) pool = hero.puzzles.slice();

    pool = pool.filter(isBiographyQuestion);

    if (!pool.length) {
      pool = fallbackQuiz(hero, {
        era: (window.QUEST_ERAS && window.QUEST_ERAS[hero.id] && window.QUEST_ERAS[hero.id].era) || ''
      });
    }

    return shuffle(pool).slice(0, CONFIG.quizCount);
  }

  function fallbackQuiz(hero, q) {
    var shortName = String(hero.name || 'чемпион').split(' ').pop();
    var era = String(q.era || '');
    var city = (era.split(',')[0] || '').trim();
    var year = (era.split(',')[1] || '').trim();
    var pool = [];

    if (window.QUEST_ERAS) {
      Object.keys(window.QUEST_ERAS).forEach(function (k) {
        if (k === hero.id) return;
        var c = String(window.QUEST_ERAS[k].era || '').split(',')[0].trim();
        if (c && c !== city && pool.indexOf(c) === -1) pool.push(c);
      });
    }
    while (pool.length < 2) pool.push(pool.length ? 'Москва' : 'Вена');

    var yNum = parseInt(year, 10);
    var years = isNaN(yNum)
      ? ['1900', '1950', '2000']
      : [String(yNum), String(yNum - 12), String(yNum + 9)];

    return [
      {
        q: 'В каком городе разворачивается эпоха ' + shortName + '?',
        options: [
          { text: city || 'Вена', correct: true, comment: 'Верно: ' + (era || 'эта эпоха') + '.' },
          { text: pool[0], correct: false, comment: 'Нет. Этот город принадлежит другой карточке.' },
          { text: pool[1], correct: false, comment: 'Мимо. Время не любит спешки.' }
        ]
      },
      {
        q: 'В каком году начинается действие квеста?',
        options: [
          { text: years[0], correct: true, comment: 'Точно: ' + (era || years[0]) + '.' },
          { text: years[1], correct: false, comment: 'Не то. Посмотрите на шапку квеста.' },
          { text: years[2], correct: false, comment: 'Слишком поздно для этой эпохи.' }
        ]
      }
    ];
  }

  var RIVAL_LORE = window.QUEST_RIVAL_LORE || {};

  function rivalLore(name) {
    var entry = RIVAL_LORE[name];
    if (!entry) return null;
    return { quote: entry.q || '', story: entry.s || '', fact: entry.f || '' };
  }

  var RIVAL_SKILLS = [
    ['TAL_STORM', 'Ярость шторма', 'Жертва 3 HP ради 18 DMG и пробития блока.'],
    ['KARPOV_ANACONDA', 'Хватка анаконды', '11 DMG, кража 1⚡ и снижение защиты врага.'],
    ['PETROSYAN_FORTRESS', 'Железная крепость', '7 DMG, щит и исцеление +8 HP.'],
    ['FISCHER_TORNADO', 'Ментальный торнадо', '14 DMG сквозь блок и цейтнотный буст.'],
    ['LASKER_GAMBIT', 'Психологический гамбит', '12 DMG и оглушение: враг теряет атаку.'],
    ['SPASSKY_GAMBIT', 'Королевский гамбит', 'Жертва 2 HP: 15 DMG, слом щита и крит.'],
    ['ANAND_LIGHTNING', 'Молния Мадраса', 'Два блиц-такта 7+7 DMG и возврат 1⚡.'],
    ['CARLSEN_ENDGAME', 'Квантовый эндшпиль', '13+ DMG и сброс 1⚡ энергии врага.'],
    ['EUWE_LOGIC', 'Математический расчёт', '13 DMG и защита +3 до конца боя.'],
    ['STEINITZ_EQUILIBRIUM', 'Теория равновесия', '12 DMG сквозь щит и подавление атаки врага.']
  ];

  var rivalSkillsApplied = false;

  function championIndex() {
    var map = {};
    if (typeof HEROES === 'undefined' || !HEROES) return map;
    Object.keys(HEROES).forEach(function (key) {
      var n = Number(key);
      var h = HEROES[key];
      if (!h || isNaN(n) || n >= 100) return;
      if (String(h.id || '').indexOf('rival-') === 0) return;
      if (h.name) map[h.name] = n;
    });
    return map;
  }

  function applyRivalSkills() {
    if (rivalSkillsApplied) return;
    rivalSkillsApplied = true;
    if (typeof HERO_STATS_DATA === 'undefined' || !HERO_STATS_DATA) return;

    var champs = championIndex();
    var used = {};
    Object.keys(champs).forEach(function (name) { used[champs[name]] = true; });

    var shadow = Object.keys(HERO_STATS_DATA)
      .map(Number)
      .filter(function (n) { return !isNaN(n) && n >= 100 && !used[n]; })
      .sort(function (a, b) { return a - b; });

    shadow.forEach(function (id, i) {
      var card = HERO_STATS_DATA[id];
      if (!card) return;
      var s = RIVAL_SKILLS[i % RIVAL_SKILLS.length];
      card.skillId = s[0];
      card.skillName = s[1];
      card.tip = s[2];
    });
  }

  function buildDuels(hero) {
    var rivals = (window.QUEST_RIVALS && window.QUEST_RIVALS[hero.id]) || null;
    if (rivals && rivals.length) {
      var champs = championIndex();
      return rivals.map(function (r) {
        var lore = rivalLore(r.n);
        var realId = champs[r.n];
        var enemyId = (realId !== undefined) ? realId : r.enemyId;
        var enemyHero = (typeof HEROES !== 'undefined' && HEROES && HEROES[enemyId])
          ? HEROES[enemyId] : null;

        var avatar = (realId !== undefined && enemyHero && enemyHero.avatar)
          ? enemyHero.avatar
          : SHADOW_AVATAR;

        return {
          enemyId: enemyId,
          name: r.n,
          years: r.y,
          style: r.s,
          avatar: avatar,
          quote: lore ? lore.quote : '',
          story: lore ? lore.story : '',
          fact: lore ? lore.fact : ''
        };
      });
    }

    if (typeof HEROES === 'undefined' || !HEROES) return [];
    var keys = Object.keys(HEROES);
    var out = [];
    for (var i = 0; i < keys.length && out.length < 5; i++) {
      var h = HEROES[keys[i]];
      if (!h || !h.id || String(h.id) === String(hero.id)) continue;
      if (String(h.id).indexOf('rival-') === 0) continue;
      var era = (window.QUEST_ERAS && window.QUEST_ERAS[h.id] && window.QUEST_ERAS[h.id].era) || '';
      var numeric = Number(keys[i]);
      out.push({
        enemyId: isNaN(numeric) ? h.id : numeric,
        name: h.name,
        years: era,
        style: h.title || 'Соперник эпохи',
        avatar: h.avatar || '',
        quote: h.quote || '',
        story: '',
        fact: h.title || ''
      });
    }
    return out;
  }

  function findHero(heroId) {
    if (typeof HEROES === 'undefined' || !HEROES) return null;
    if (HEROES[heroId]) return HEROES[heroId];
    if (HEROES[String(heroId)]) return HEROES[String(heroId)];
    var keys = Object.keys(HEROES);
    for (var i = 0; i < keys.length; i++) {
      var h = HEROES[keys[i]];
      if (h && String(h.id) === String(heroId)) return h;
    }
    return null;
  }

  function resolveQuest(heroId) {
    var hero = findHero(heroId);
    if (!hero) return null;

    var data = (window.QUEST_DATA && window.QUEST_DATA[hero.id]) || {};
    var eras = (window.QUEST_ERAS && window.QUEST_ERAS[hero.id]) || {};

    var quiz = resolveQuiz(hero, data);

    var attack = (data.attack && data.attack.length)
      ? pickPuzzles(data.attack, CONFIG.puzzleCount)
      : [];
    if (!attack.length) attack = fromDuelPuzzles('attack', hero.id);

    var defense = (data.defense && data.defense.length)
      ? pickPuzzles(data.defense, CONFIG.puzzleCount)
      : [];
    if (!defense.length) defense = fromDuelPuzzles('defense', hero.id);

    var heroName = hero.name || 'Чемпион';
    var eraLabel = eras.era || hero.title || 'эпоха чемпиона';

    var story = (window.QUEST_STORY && window.QUEST_STORY[hero.id]) || {};

    var welcome = (story.welcome && story.welcome.length) ? story.welcome : [
      'Ты оживил карточку — и она стала билетом в прошлое. Теперь это не портрет, а дверь в эпоху, где жил и побеждал ' + heroName + '.',
      'Машина времени настроена на ' + eraLabel + '. Впереди пять уровней: память чемпиона, пробуждение силы, скрытая угроза, пять поединков и партия с Хранителем времени.',
      'Кристаллы времени уже светятся. Не теряй их зря — и не теряй жизней: их всего десять.'
    ];

    var awake = (story.awake && story.awake.length) ? story.awake : [
      'Вы просыпаетесь в незнакомом месте. Воздух другой: ' + eraLabel + '. Слышно, как идёт чужая жизнь — и она теперь ваша.',
      'Вы с удивлением осознаёте, что оказались в теле будущего чемпиона — ' + heroName + '. Руки помнят вес фигур, а в голове звучит чужая мысль.',
      'Вам предстоит пройти его путь: пять уровней становления и финальная партия с Хранителем времени.'
    ];

    return {
      id: hero.id || heroId,
      name: heroName,
      shortName: heroName.split(' ').pop(),
      era: eraLabel,
      piece: eras.piece || 'king',
      mission: data.mission || 'Пройти пять уровней пути и выстоять в партии с Хранителем времени.',
      welcome: welcome,
      awake: awake,
      quiz: quiz,
      attack: attack,
      defense: defense,
      duels: buildDuels(hero)
    };
  }

  var PROLOGUE = window.QUEST_PROLOGUE || { common: {}, heroes: {} };

  function prologueFor() {
    var q = state.quest || {};
    var hero = state.hero || {};

    var src = PROLOGUE.heroes || {};
    var common = PROLOGUE.common || {};
    var entry = src[hero.id] || src[q.id] || null;

    return {
      lead: common.lead || 'Ты оживил карточку чемпиона — и открыл дверь в его эпоху.',
      hook: (entry && entry.hook) || (q.welcome && q.welcome[0]) || 'Карточка ожила, и время дрогнуло.',
      scene: (entry && entry.scene) || (q.welcome && q.welcome[1]) || 'Воздух другой эпохи уже вокруг тебя.',
      stakes: (entry && entry.stakes) || 'Пять уровней, десять жизней и один финальный поединок. Ошибка стоит жизни — но путь можно пройти заново.',
      tail: common.tail || 'Пять уровней. Десять жизней. Одна корона.'
    };
  }

  function bioFor(hero) {
    var extended = (hero && window.QUEST_BIO && window.QUEST_BIO[hero.id]) || null;
    if (extended && extended.length) {
      return extended.map(function (text) { return { title: '', text: text }; });
    }
    if (hero && hero.bio && hero.bio.length) return hero.bio;
    var p = prologueFor();
    return [
      { title: 'Эпоха', text: p.scene },
      { title: 'Ставка', text: p.hook },
      { title: 'Путь', text: p.stakes }
    ];
  }

  /* ==========================================================
     ЭКРАН, ПРЕДЗАГРУЗКА
     ========================================================== */
  var viewportBound = false;

  function syncViewport() {
    var vv = window.visualViewport;
    var h = (vv && vv.height) ? vv.height : window.innerHeight;
    if (!h || h < 200) return;
    document.documentElement.style.setProperty('--tmq-vh', Math.round(h) + 'px');
  }

  function bindViewport() {
    syncViewport();
    if (viewportBound) return;
    viewportBound = true;
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', function () {
      setTimeout(syncViewport, 120);
      setTimeout(syncViewport, 420);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', syncViewport);
      window.visualViewport.addEventListener('scroll', syncViewport);
    }
  }

  var piecesWarmed = false;

  function preloadPieces() {
    if (piecesWarmed) return;
    piecesWarmed = true;
    var theme = window.DUEL_BOARD_THEME || CONFIG.pieceTheme;
    if (!theme || theme.indexOf('{piece}') === -1) return;
    ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'].forEach(function (p) {
      var img = new Image();
      img.decoding = 'async';
      img.src = theme.replace('{piece}', p);
    });
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
          '<div class="tmq-head-main">' +
            '<div class="tmq-era">' +
              '<span id="tmq-city">—</span>' +
              '<span class="tmq-era-sep">·</span>' +
              '<span class="tmq-era-year" id="tmq-year">—</span>' +
            '</div>' +
            '<div class="tmq-head-sub" id="tmq-head-sub">—</div>' +
          '</div>' +
          '<div class="tmq-head-side">' +
            '<div class="tmq-lives" id="tmq-lives"></div>' +
            '<button class="tmq-back" type="button" id="tmq-back" aria-label="Назад" hidden>‹</button>' +
            '<button class="tmq-close" type="button" id="tmq-close" aria-label="Закрыть квест">✕</button>' +
          '</div>' +
        '</header>' +
        '<div class="tmq-beat" id="tmq-beat" aria-live="polite"></div>' +
        '<div class="tmq-body" id="tmq-body"></div>' +
        '<div class="tmq-foot" id="tmq-foot" hidden></div>' +
      '</div>';

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      card: overlay.querySelector('.tmq-card'),
      body: overlay.querySelector('#tmq-body'),
      beat: overlay.querySelector('#tmq-beat'),
      lives: overlay.querySelector('#tmq-lives'),
      city: overlay.querySelector('#tmq-city'),
      year: overlay.querySelector('#tmq-year'),
      headSub: overlay.querySelector('#tmq-head-sub'),
      back: overlay.querySelector('#tmq-back'),
      closeBtn: overlay.querySelector('#tmq-close'),
      foot: overlay.querySelector('#tmq-foot')
    };

    dom.back.addEventListener('click', goBack);
    dom.closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && !state.inBattle) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !isOpen() || state.inBattle) return;
      close();
    });

    dom.card.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      var before = lastBeatAt;
      setTimeout(function () {
        if (isOpen() && lastBeatAt === before) say(beatText('generic'));
      }, 0);
    }, true);

    return dom;
  }

  function updateBack() {
    if (!dom || !dom.back) return;
    var show = nav.length > 1 && !state.inBattle && state.screen !== 'gameover';
    dom.back.hidden = !show;
  }

  function pushNav(entry) {
    var last = nav[nav.length - 1];
    if (last && last.s === entry.s && last.step === entry.step && last.i === entry.i) {
      updateBack();
      return;
    }
    nav.push(entry);
    if (nav.length > 40) nav.shift();
    updateBack();
  }

  function resetNav(base) {
    nav = (base || []).slice();
    updateBack();
  }

  function goBack() {
    if (!dom || state.inBattle) return;
    if (nav.length <= 1) return;
    nav.pop();
    var prev = nav[nav.length - 1];
    if (!prev) return;
    play('click');
    beat('back');
    renderEntry(prev);
  }

  function renderEntry(e) {
    if (!e) return;
    if (e.s === 'greet') { renderGreet(true); return; }
    if (e.s === 'bio') { renderBio(true); return; }
    if (e.s === 'awake') { renderAwake(true); return; }
    if (e.s === 'map') { renderMap(true); return; }
    if (e.s === 'briefing') { renderBriefing(e.i, true); return; }
    if (e.s === 'quiz') {
      state.step = e.step;
      state.answered = false;
      state.chosen = null;
      renderQuiz(true);
      return;
    }
    if (e.s === 'attack' || e.s === 'defense') {
      state.step = e.step;
      renderPuzzle(e.s, true);
      return;
    }
    if (e.s === 'duels') { renderDuel(true); return; }
    if (e.s === 'final') { renderFinal(true); return; }
    if (e.s === 'defeat') { renderMap(true); return; }
    renderMap(true);
  }

  function renderHead() {
    if (!dom) return;
    var q = state.quest || {};
    var era = String(q.era || '');
    var parts = era.split(',');

    dom.city.textContent = (parts[0] || '—').trim();
    dom.year.textContent = (parts[1] || '').trim() || '—';
    dom.headSub.textContent = q.name || 'Чемпион';

    var out = '';
    for (var i = 1; i <= CONFIG.maxLives; i++) {
      out += '<i class="tmq-life' + (i <= state.lives ? '' : ' is-off') + '"></i>';
    }
    dom.lives.innerHTML = out + '<b class="tmq-lives-num">' + state.lives + '/' + CONFIG.maxLives + '</b>';

    updateBack();
  }

  function renderLives(shake) {
    renderHead();
    if (shake && dom.lives) {
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

  function chapter(num, title, note) {
    return '<div class="tmq-chapter">' +
      '<span class="tmq-chapter-num">' + esc(num) + '</span>' +
      '<span class="tmq-chapter-title">' + esc(title) + '</span>' +
      '<span class="tmq-chapter-note">' + esc(note || '') + '</span>' +
      '</div>';
  }

  function setBody(html) {
    clearWarp();
    renderHead();

    if (state.board && typeof state.board.destroy === 'function') {
      try { state.board.destroy(); } catch (e) {}
    }
    state.board = null;

    dom.body.innerHTML = html;
    bindAvatars(dom.body);
    dom.body.scrollTop = 0;

    if (dom.foot) {
      dom.foot.innerHTML = '';
      dom.foot.hidden = true;
    }
  }

  function setFoot(html) {
    if (!dom || !dom.foot) return;
    dom.foot.innerHTML = html || '';
    dom.foot.hidden = !html;
    bindAvatars(dom.foot);
  }

  function clearWarp() {
    if (!dom) return;
    var node = dom.overlay.querySelector('.tmq-warp');
    if (node && node.parentNode) node.parentNode.removeChild(node);
    dom.overlay.classList.remove('tmq-warping');
    stopWarpFx();
  }

  /* ==========================================================
     ДОСКА
     ========================================================== */
  var GLYPH = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  function createDuelBoard(host, fen, opts) {
    opts = opts || {};
    var $ = window.jQuery;
    var Ctor = window.Chess;

    if (!host) return null;
    if (typeof window.Chessboard !== 'function' || !$ || typeof Ctor !== 'function') return null;

    if (!host.id) host.id = 'tmq-board-' + Math.random().toString(36).slice(2, 7);
    host.classList.add('tmq-strike');
    host.innerHTML = '';

    var game;
    try { game = new Ctor(fen); } catch (e) { return null; }
    if (!game || typeof game.moves !== 'function' || typeof game.get !== 'function') return null;

    var theme = window.DUEL_BOARD_THEME || CONFIG.pieceTheme;
    var board;
    try {
      board = window.Chessboard(host.id, {
        position: fen,
        draggable: false,
        showNotation: true,
        pieceTheme: theme
      });
    } catch (e) {
      return null;
    }
    if (!board) return null;

    var $host = $(host);
    var selected = null;
    var locked = false;
    var HINT = 'tmq-hint-sel tmq-hint-sq tmq-hint-cap';

    function cell(square) {
      return $host.find('[data-square="' + square + '"]');
    }

    function clearHints() {
      $host.find('.tmq-hint-sel, .tmq-hint-sq, .tmq-hint-cap').removeClass(HINT);
      selected = null;
    }

    function shake() {
      host.classList.remove('is-shake');
      void host.offsetWidth;
      host.classList.add('is-shake');
      setTimeout(function () { host.classList.remove('is-shake'); }, 460);
    }

    function select(square) {
      clearHints();
      var piece = game.get(square);
      if (!piece || piece.color !== game.turn()) return false;

      selected = square;
      cell(square).addClass('tmq-hint-sel');
      game.moves({ square: square, verbose: true }).forEach(function (m) {
        cell(m.to).addClass(game.get(m.to) ? 'tmq-hint-cap' : 'tmq-hint-sq');
      });
      play('playMove');
      return true;
    }

    function commit(from, to) {
      var ok = !opts.solution || (from === opts.solution.from && to === opts.solution.to);
      var made;
      try { made = game.move({ from: from, to: to, promotion: 'q' }); } catch (e) { made = null; }
      if (!made) { clearHints(); return; }

      board.position(game.fen(), false);
      clearHints();

      if (ok) {
        locked = true;
        if (opts.onResult) setTimeout(function () { opts.onResult(true, from, to); }, 200);
        return;
      }

      locked = true;
      shake();
      if (opts.onResult) opts.onResult(false, from, to);
      setTimeout(function () {
        try { game.undo(); } catch (e) {}
        board.position(game.fen(), false);
        locked = false;
      }, 620);
    }

    function onSquare(ev) {
      if (locked) return;
      var square = $(ev.currentTarget).attr('data-square');
      if (!square) return;
      if (ev.preventDefault) ev.preventDefault();

      if (selected) {
        if (square === selected) { clearHints(); return; }
        var legal = game.moves({ square: selected, verbose: true })
          .some(function (m) { return m.to === square; });
        if (legal) { commit(selected, square); return; }
      }

      var piece = game.get(square);
      if (piece && piece.color === game.turn()) { select(square); return; }
      clearHints();
    }

    $host.off('click.tmqBoard', '.square-55d63');
    $host.on('click.tmqBoard', '.square-55d63', onSquare);

    function resize() { try { board.resize(); } catch (e) {} }
    setTimeout(resize, 60);
    setTimeout(resize, 220);

    return {
      el: host,
      getFen: function () { return game.fen(); },
      setFen: function (f) {
        try { game.load(f); } catch (e) {}
        try { board.position(f, false); } catch (e) {}
        clearHints();
        locked = false;
        resize();
      },
      resize: resize,
      destroy: function () {
        $host.off('click.tmqBoard');
        try { board.destroy(); } catch (e) {}
        host.innerHTML = '';
      }
    };
  }

  function createCssBoard(host, fen, opts) {
    var files = 'abcdefgh';
    var curFen = fen;
    var pos = Chess.parse(curFen);
    var selected = null;
    var locked = false;
    var cells = {};

    var grid = document.createElement('div');
    grid.className = 'tmq-board';
    host.innerHTML = '';
    host.appendChild(grid);

    function mkLabel(cls, text) {
      var i = document.createElement('i');
      i.className = 'tmq-lbl ' + cls;
      i.textContent = text;
      return i;
    }

    function paint() {
      grid.innerHTML = '';
      cells = {};
      for (var rank = 8; rank >= 1; rank--) {
        for (var f = 0; f < 8; f++) {
          var sq = files.charAt(f) + rank;
          var cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'tmq-sq ' + (((f + rank) % 2 === 1) ? 'is-dark' : 'is-light');
          cell.setAttribute('data-sq', sq);
          cell.setAttribute('aria-label', 'Поле ' + sq);

          var piece = pos.board[sq];
          if (piece) {
            var span = document.createElement('span');
            span.className = 'tmq-pc ' + (piece === piece.toUpperCase() ? 'is-w' : 'is-b');
            span.textContent = GLYPH[piece] || '';
            cell.appendChild(span);
          }
          if (f === 0) cell.appendChild(mkLabel('tmq-lbl-rank', String(rank)));
          if (rank === 1) cell.appendChild(mkLabel('tmq-lbl-file', files.charAt(f)));

          cells[sq] = cell;
          grid.appendChild(cell);
        }
      }
    }

    function clearMarks() {
      for (var sq in cells) {
        if (!Object.prototype.hasOwnProperty.call(cells, sq)) continue;
        cells[sq].classList.remove('is-sel');
        var dots = cells[sq].querySelectorAll('.tmq-dot, .tmq-ring');
        for (var i = 0; i < dots.length; i++) dots[i].parentNode.removeChild(dots[i]);
      }
      selected = null;
    }

    function select(sq) {
      clearMarks();
      selected = sq;
      cells[sq].classList.add('is-sel');
      var list = Chess.moves(curFen, sq);
      for (var i = 0; i < list.length; i++) {
        var target = cells[list[i].to];
        if (!target) continue;
        var mark = document.createElement('i');
        mark.className = list[i].capture ? 'tmq-ring' : 'tmq-dot';
        target.appendChild(mark);
      }
      play('playMove');
    }

    function commit(from, to) {
      locked = true;
      clearMarks();
      var correct = !opts.solution || (from === opts.solution.from && to === opts.solution.to);

      if (correct) {
        if (cells[from]) cells[from].classList.add('is-ok-from');
        if (cells[to]) cells[to].classList.add('is-ok-to');
        var next = Chess.apply(curFen, from, to);
        setTimeout(function () {
          curFen = next;
          pos = Chess.parse(curFen);
          paint();
          if (cells[from]) cells[from].classList.add('is-ok-from');
          if (cells[to]) cells[to].classList.add('is-ok-to');
          if (opts.onResult) opts.onResult(true, from, to);
        }, 220);
      } else {
        if (cells[from]) cells[from].classList.add('is-bad-from');
        if (cells[to]) cells[to].classList.add('is-bad-to');
        host.classList.remove('is-shake');
        void host.offsetWidth;
        host.classList.add('is-shake');
        if (opts.onResult) opts.onResult(false, from, to);
        setTimeout(function () {
          for (var sq in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, sq)) continue;
            cells[sq].classList.remove('is-bad-from', 'is-bad-to');
          }
          locked = false;
        }, 780);
      }
    }

    grid.addEventListener('click', function (e) {
      var cell = e.target.closest ? e.target.closest('.tmq-sq') : null;
      if (!cell || locked) return;
      var sq = cell.getAttribute('data-sq');
      var piece = pos.board[sq];

      if (selected && sq === selected) { clearMarks(); return; }
      if (selected) {
        var list = Chess.moves(curFen, selected);
        for (var i = 0; i < list.length; i++) {
          if (list[i].to === sq) { commit(selected, sq); return; }
        }
      }
      if (piece && Chess.colorOf(piece) === pos.turn) { select(sq); return; }
      clearMarks();
    });

    var sizeTries = 0;
    function syncSize() {
      var w = host.clientWidth || grid.getBoundingClientRect().width;
      if (!w) {
        if (sizeTries++ < 40) requestAnimationFrame(syncSize);
        return;
      }
      grid.style.height = Math.round(w) + 'px';
    }

    paint();
    syncSize();

    if (typeof ResizeObserver !== 'undefined') {
      try {
        var ro = new ResizeObserver(syncSize);
        ro.observe(host);
      } catch (e) {}
    }
    window.addEventListener('resize', syncSize);
    setTimeout(syncSize, 60);

    return {
      el: grid,
      getFen: function () { return curFen; },
      setFen: function (f) {
        curFen = f;
        pos = Chess.parse(f);
        locked = false;
        clearMarks();
        paint();
        syncSize();
      },
      resize: syncSize,
      destroy: function () { host.innerHTML = ''; }
    };
  }

  function createBoard(host, fen, opts) {
    opts = opts || {};
    if (!host) return null;

    try {
      var made = createDuelBoard(host, fen, opts);
      if (made && host.querySelector('.board-b72b1')) return made;
      if (made) {
        try { made.destroy(); } catch (e) {}
        host.innerHTML = '';
      }
    } catch (e) {
      host.innerHTML = '';
    }

    return createCssBoard(host, fen, opts);
  }

  /* ==========================================================
     I. ПРИВЕТСТВИЕ
     ========================================================== */
  function renderGreet(isBack) {
    if (!isBack) pushNav({ s: 'greet' });
    state.screen = 'greet';

    var q = state.quest;
    var p = prologueFor();
    var hero = state.hero || {};
    var saved = state.stage;

    var warpBtn =
      '<button class="tmq-cta is-warp" type="button" id="tmq-jump">' +
        '<span class="tmq-cta-label">Прыжок во времени</span>' +
      '</button>';

    var primary = saved > 0
      ? '<button class="tmq-cta" type="button" id="tmq-continue">Продолжить путь · уровень ' +
        esc(CONFIG.route[saved] ? CONFIG.route[saved].num : 'V') + '</button>' +
        warpBtn +
        '<div class="tmq-linkrow">' +
          '<button class="tmq-link" type="button" id="tmq-bio">Биография</button>' +
          '<button class="tmq-link" type="button" id="tmq-restart">Начать заново</button>' +
        '</div>'
      : warpBtn +
        '<button class="tmq-link" type="button" id="tmq-bio">Биография чемпиона</button>';

    setBody(
      '<div class="tmq-welcome">' +
        '<h2 class="tmq-welcome-title">Добро пожаловать<br>на турнир «Машина времени»</h2>' +
        '<div class="tmq-plate">' +
          '<span class="tmq-plate-frame" aria-hidden="true"></span>' +
          '<span class="tmq-plate-ava">' + avatarHtml(hero, 'is-plate') + '</span>' +
          '<span class="tmq-plate-body">' +
            '<span class="tmq-plate-eyebrow">' + esc(q.era) + '</span>' +
            '<span class="tmq-plate-name">' + esc(q.name) + '</span>' +
            '<span class="tmq-plate-rule" aria-hidden="true"></span>' +
            '<span class="tmq-plate-title">' + esc(hero.title || 'Чемпион мира по шахматам') + '</span>' +
          '</span>' +
        '</div>' +
        '<div class="tmq-story">' +
          '<p class="is-lead">' + esc(p.lead) + '</p>' +
          '<p>' + esc(p.hook) + '</p>' +
          '<p>' + esc(p.scene) + '</p>' +
          '<p>' + esc(p.stakes) + '</p>' +
        '</div>' +
        '<div class="tmq-stakes">' +
          '<span><b>5</b> уровней</span>' +
          '<span><b>' + CONFIG.maxLives + '</b> жизней</span>' +
          '<span><b>' + q.duels.length + '</b> поединков</span>' +
        '</div>' +
        primary +
      '</div>'
    );

    var jump = dom.body.querySelector('#tmq-jump');
    if (jump) {
      jump.addEventListener('click', function () {
        play('warp');
        beat('jump');
        renderWarp();
      });
    }

    var bio = dom.body.querySelector('#tmq-bio');
    if (bio) {
      bio.addEventListener('click', function () {
        play('click');
        beat('bio');
        renderBio();
      });
    }

    var cont = dom.body.querySelector('#tmq-continue');
    if (cont) {
      cont.addEventListener('click', function () {
        play('click');
        beat('resume');
        renderMap();
      });
    }

    var restart = dom.body.querySelector('#tmq-restart');
    if (restart) {
      restart.addEventListener('click', function () {
        state.stage = 0;
        state.step = 0;
        state.duelIdx = 0;
        state.lives = CONFIG.maxLives;
        clearSaved();
        play('click');
        beat('restart');
        renderGreet();
      });
    }
  }

  function renderBio(isBack) {
    if (!isBack) pushNav({ s: 'bio' });
    state.screen = 'bio';
    var hero = state.hero || {};
    var bio = bioFor(hero);

    setBody(
      '<div class="tmq-stage-head">' +
        '<span class="tmq-badge">Хроники · ' + esc(state.quest.name) + '</span>' +
        '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-bio-back">Назад</button>' +
      '</div>' +
      '<div class="tmq-bio-head">' +
        avatarHtml(hero, 'is-md') +
        '<div>' +
          '<div class="tmq-cover-name">' + esc(hero.name || '') + '</div>' +
          '<div class="tmq-cover-title">' + esc(hero.title || '') + '</div>' +
        '</div>' +
      '</div>' +
      (hero.quote ? '<div class="tmq-quote">' + esc(hero.quote) + '</div>' : '') +
      '<div class="tmq-copy">' +
        (bio.length
          ? bio.map(function (s) {
              return s.title
                ? '<p><strong>' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>'
                : '<p>' + esc(s.text) + '</p>';
            }).join('')
          : '<p>Биография этой карточки ещё не заполнена.</p>') +
      '</div>' +
      '<button class="tmq-cta is-warp" type="button" id="tmq-bio-next">' +
        '<span class="tmq-cta-label">Прыжок во времени</span>' +
      '</button>'
    );

    dom.body.querySelector('#tmq-bio-back').addEventListener('click', function () {
      play('click');
      renderGreet();
    });
    dom.body.querySelector('#tmq-bio-next').addEventListener('click', function () {
      play('warp');
      beat('jump');
      renderWarp();
    });
  }

  /* ==========================================================
     II. ВАРП
     ========================================================== */
  var WarpFx = { raf: 0, alive: false, done: false };

  function stopWarpFx() {
    WarpFx.alive = false;
    if (WarpFx.raf) {
      cancelAnimationFrame(WarpFx.raf);
      WarpFx.raf = 0;
    }
  }

  function warpQuality() {
    var dpr = window.devicePixelRatio || 1;
    var cores = navigator.hardwareConcurrency || 4;
    var small = Math.min(window.innerWidth, window.innerHeight) < 560;
    var low = cores <= 4 || small || dpr >= 2.5;
    return {
      low: low,
      count: low ? 38 : 84,
      dpr: Math.min(low ? 1 : 1.5, dpr),
      maxPx: low ? 460 : 820
    };
  }

  function startWarpStars(canvas) {
    stopWarpFx();
    if (!canvas || !canvas.getContext) return;

    var q = warpQuality();
    var ctx;
    try { ctx = canvas.getContext('2d'); } catch (e) { return; }
    if (!ctx) return;

    var w = 1;
    var h = 1;

    function resize() {
      var rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      var scale = Math.min(1, q.maxPx / Math.max(w, h));
      canvas.width = Math.round(w * scale * q.dpr);
      canvas.height = Math.round(h * scale * q.dpr);
      ctx.setTransform(scale * q.dpr, 0, 0, scale * q.dpr, 0, 0);
    }
    resize();

    var stars = [];
    for (var i = 0; i < q.count; i++) {
      stars.push({
        a: Math.random() * Math.PI * 2,
        d: Math.random() * 0.5,
        v: 0.6 + Math.random() * 1.4,
        s: 0.7 + Math.random() * 1.3
      });
    }

    var t0 = performance.now();
    WarpFx.alive = true;

    function frame(now) {
      if (!WarpFx.alive) return;
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      var cx = w / 2;
      var cy = h / 2;
      var maxD = Math.sqrt(w * w + h * h) * 0.6;

      ctx.lineCap = 'round';
      for (var k = 0; k < stars.length; k++) {
        var st = stars[k];
        var d = (st.d + t * st.v * 0.6) % 1;
        if (d < 0.03) continue;
        var r = d * maxD;
        var r0 = Math.max(0, d - 0.045) * maxD;
        var ca = Math.cos(st.a);
        var sa = Math.sin(st.a);

        ctx.strokeStyle = 'rgba(170,236,255,' + (d * 0.8).toFixed(3) + ')';
        ctx.lineWidth = st.s * (0.5 + d * 1.5);
        ctx.beginPath();
        ctx.moveTo(cx + ca * r0, cy + sa * r0);
        ctx.lineTo(cx + ca * r, cy + sa * r);
        ctx.stroke();
      }

      WarpFx.raf = requestAnimationFrame(frame);
    }
    WarpFx.raf = requestAnimationFrame(frame);
  }

  function renderWarp() {
    state.screen = 'warp';
    var q = state.quest;

    setBody('');
    updateBack();

    var warp = document.createElement('div');
    warp.className = 'tmq-warp';
    warp.innerHTML =
      '<canvas class="tmq-warp-stars" id="tmq-warp-stars"></canvas>' +
      '<div class="tmq-warp-glow"></div>' +
      '<div class="tmq-warp-rings"><i></i><i></i><i></i></div>' +
      '<div class="tmq-warp-panel">' +
        '<div class="tmq-warp-label">ВАРП-ПРЫЖОК</div>' +
        '<div class="tmq-warp-target">' + esc(q.era) + '</div>' +
        '<div class="tmq-warp-dots"><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="tmq-warp-status" id="tmq-warp-status">стабилизация канала</div>' +
      '</div>' +
      '<div class="tmq-warp-skip">нажмите, чтобы пропустить</div>' +
      '<div class="tmq-warp-flash"></div>';

    dom.overlay.appendChild(warp);
    dom.overlay.classList.add('tmq-warping');

    WarpFx.done = false;
    startWarpStars(warp.querySelector('#tmq-warp-stars'));

    var status = warp.querySelector('#tmq-warp-status');

    function finishWarp() {
      if (WarpFx.done) return;
      WarpFx.done = true;
      clearTimers();
      stopWarpFx();
      renderAwake();
      play('arrival');
    }

    warp.addEventListener('click', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      finishWarp();
    });

    after(560, function () { if (status) status.textContent = 'расчёт координат'; });
    after(1120, function () { if (status) status.textContent = 'переход сквозь эпоху'; });
    after(1680, function () {
      if (status) status.textContent = 'прибытие';
      warp.classList.add('is-flash');
      if (navigator.vibrate) {
        try { navigator.vibrate([16, 36, 22]); } catch (e) {}
      }
    });
    after(2180, finishWarp);
  }

  /* ==========================================================
     III. ПРОБУЖДЕНИЕ
     ========================================================== */
  function renderAwake(isBack) {
    if (!isBack) pushNav({ s: 'awake' });
    state.screen = 'awake';
    var q = state.quest;
    var p = prologueFor();

    var lines = (q.awake && q.awake.length) ? q.awake : [
      p.scene,
      'Ты делаешь вдох — и понимаешь, что дышишь чужими лёгкими. Это тело чемпиона, и оно помнит вес фигур лучше, чем ты помнишь собственное имя.',
      'Впереди пять уровней. Первый — память: без неё сила не проснётся.'
    ];

    setBody(
      '<div class="tmq-awake">' +
        '<div class="tmq-kicker">' + esc(q.era) + '</div>' +
        '<h2 class="tmq-awake-title">Вы проснулись.</h2>' +
        '<div class="tmq-copy tmq-copy-quote">' +
          lines.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
        '</div>' +
        '<button class="tmq-cta" type="button" id="tmq-map">Карта уровней</button>' +
      '</div>'
    );

    beat('awake');

    dom.body.querySelector('#tmq-map').addEventListener('click', function () {
      play('click');
      beat('map');
      renderMap();
    });
  }

  /* ==========================================================
     IV. КАРТА УРОВНЕЙ
     ========================================================== */
  function renderMap(isBack) {
    if (!isBack) pushNav({ s: 'map' });
    state.screen = 'map';
    var q = state.quest;
    var current = state.stage;

    var cards = CONFIG.route.map(function (item, i) {
      var status = i < current ? 'done' : i === current ? 'active' : 'locked';
      var label = status === 'done' ? 'Пройдено' : status === 'active' ? 'Сейчас' : 'Впереди';
      var meta = item.key === 'quiz' ? q.quiz.length + ' вопроса'
        : item.key === 'attack' ? q.attack.length + ' задачи'
        : item.key === 'defense' ? q.defense.length + ' задачи'
        : item.key === 'duels' ? q.duels.length + ' поединков'
        : 'Lichess';

      return '<article class="tmq-route ' + status + '">' +
        '<div class="tmq-rail"><span class="tmq-node">' + (status === 'done' ? '✔' : esc(item.num)) + '</span>' +
        '<span class="tmq-rail-line"></span></div>' +
        '<div class="tmq-route-body">' +
          '<div class="tmq-route-head">' +
            '<span class="tmq-route-title">' + esc(item.title) + '</span>' +
            '<span class="tmq-route-status">' + label + '</span>' +
          '</div>' +
          '<div class="tmq-route-sub">' + esc(item.sub) + ' · ' + esc(meta) + '</div>' +
          '<div class="tmq-route-why">' + esc(item.why || '') + '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    setBody(
      '<div class="tmq-title">Пять уровней становления</div>' +
      '<div class="tmq-synopsis">' +
        '<p>' + esc(CONFIG.synopsis) + '</p>' +
      '</div>' +
      '<div class="tmq-copy"><p class="is-lead">' + esc(q.mission) + '</p></div>' +
      '<div class="tmq-route-list">' + cards + '</div>'
    );

    var active = current < CONFIG.route.length ? current : -1;
    if (active >= 0) {
      setFoot(
        '<button class="tmq-cta tmq-foot-cta" type="button" id="tmq-enter">Пройти уровень</button>'
      );
      dom.foot.querySelector('#tmq-enter').addEventListener('click', function () {
        play('playMove');
        beat('briefing');
        renderBriefing(active);
      });

      var activeCard = dom.body.querySelector('.tmq-route.active');
      if (activeCard) {
        setTimeout(function () {
          if (!isOpen()) return;
          try { activeCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
        }, 140);
      }
    }
  }

  /* ==========================================================
     V. БРИФИНГ
     ========================================================== */
  function renderBriefing(index, isBack) {
    if (!isBack) pushNav({ s: 'briefing', i: index });
    state.screen = 'briefing';
    state.stage = index;
    saveProgress();

    var route = CONFIG.route[index];
    if (!route) { renderMap(); return; }

    if (index === 4) { renderFinalBriefing(route); return; }

    var isDuels = index === 3;

    var rows = isDuels
      ? '<div class="tmq-brief-row">' +
          '<span class="tmq-brief-key">Что будет</span>' +
          '<span class="tmq-brief-val">Пять поединков. У каждого соперника свой характер ' +
            'и свой коронный ход.</span>' +
        '</div>' +
        '<div class="tmq-brief-row">' +
          '<span class="tmq-brief-key">Как играть</span>' +
          '<span class="tmq-brief-val">' +
            '<span class="tmq-brief-line"><b>Атака</b> — задача на атаку. Верный ход бьёт сильно.</span>' +
            '<span class="tmq-brief-line"><b>Защита</b> — задача на защиту. Верный ход ослабляет удар соперника.</span>' +
            '<span class="tmq-brief-line"><b>Коронный ход</b> — приём чемпиона. Нужны два заряда, они копятся защитой.</span>' +
            '<span class="tmq-brief-line">У каждого по <i>50 HP</i>.</span>' +
          '</span>' +
        '</div>'
      : (route.brief || []).map(function (row) {
          return '<div class="tmq-brief-row">' +
            '<span class="tmq-brief-key">' + esc(row[0]) + '</span>' +
            '<span class="tmq-brief-val">' + esc(row[1]) + '</span>' +
            '</div>';
        }).join('');

    var opening = [
      'Память — единственное, что нельзя отнять. Но её можно потерять.',
      'Сила просыпается не в мышцах, а в точном расчёте.',
      'Угроза всегда приходит раньше, чем её замечают.',
      'Пять соперников. Пять эпох. Ни одного права на ошибку.',
      'Часы уже идут.'
    ][index] || '';

    setBody(
      '<div class="tmq-title">' + esc(route.title) + '</div>' +
      (isDuels
        ? ''
        : '<div class="tmq-sub">' + esc(route.sub) + '</div>' +
          '<div class="tmq-copy">' +
            '<p class="is-lead">' + esc(opening) + '</p>' +
            '<p>' + esc(route.text) + '</p>' +
          '</div>') +
      '<div class="tmq-brief">' + rows + '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-start">Начать уровень</button>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-back">К карте уровней</button>'
    );

    dom.body.querySelector('#tmq-start').addEventListener('click', function () {
      play('playMove');
      state.step = 0;
      state.answered = false;
      state.chosen = null;
      enterStage(route.key);
    });
    dom.body.querySelector('#tmq-back').addEventListener('click', function () {
      play('click');
      renderMap();
    });
  }

  function renderFinalBriefing(route) {
    var q = state.quest || {};
    var hero = state.hero || {};

    var rows = (route.brief || []).filter(function (row) {
      return String(row[0]).toLowerCase().indexOf('как') !== 0;
    }).map(function (row) {
      return '<div class="tmq-brief-row">' +
        '<span class="tmq-brief-key">' + esc(row[0]) + '</span>' +
        '<span class="tmq-brief-val">' + esc(row[1]) + '</span>' +
        '</div>';
    }).join('');

    setBody(
      '<div class="tmq-boss-brief">' +
        '<div class="tmq-boss-brief-glow" aria-hidden="true"></div>' +
        '<h2 class="tmq-boss-brief-title">Хранитель времени</h2>' +
        '<p class="tmq-boss-brief-lead">Он не играет в шахматы. Он играет со временем.</p>' +
        '<p class="tmq-boss-brief-text">' +
          'Ты прошёл память, силу, оборону и пятерых соперников. ' +
          esc(hero.name || q.name || 'Чемпион') + ' снова тот, кем был, — и это твоя победа. ' +
          'Но портал закрылся за спиной, и открыть его может только тот, кто держит ключи от всех эпох.' +
        '</p>' +
        '<p class="tmq-boss-brief-text">' +
          'За дверью нет зала. Только стол, две чашки и часы, которые идут громче обычного. ' +
          'Хранитель знает каждый твой ход — он видел их все, в других веках, с другими детьми. ' +
          'Он не знает одного: как ты сыграешь сейчас.' +
        '</p>' +
        '<div class="tmq-boss-brief-quote">' +
          '«Я ждал тебя с первой минуты. Сядь. У нас всего одна партия — и целая вечность на неё»' +
        '</div>' +
      '</div>' +
      '<div class="tmq-brief">' + rows + '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-start">Начать финальную партию</button>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-back">К карте уровней</button>'
    );

    dom.body.querySelector('#tmq-start').addEventListener('click', function () {
      play('heroic');
      state.step = 0;
      state.answered = false;
      state.chosen = null;
      renderFinal();
    });
    dom.body.querySelector('#tmq-back').addEventListener('click', function () {
      play('click');
      renderMap();
    });
  }

  function enterStage(key) {
    if (key === 'quiz') renderQuiz();
    else if (key === 'attack') renderPuzzle('attack');
    else if (key === 'defense') renderPuzzle('defense');
    else if (key === 'duels') renderDuel();
    else renderFinal();
  }

  /* ==========================================================
     VI. ВОПРОСЫ
     ========================================================== */
  function renderQuiz(isBack) {
    if (!isBack) pushNav({ s: 'quiz', step: state.step });
    state.screen = 'quiz';
    var q = state.quest;
    var item = q.quiz[state.step];
    if (!item) { finishStage(0); return; }

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
        (!chosen.correct && correct
          ? '<br><span class="tmq-dimline">Правильный ответ: ' + esc(correct.text) + '. ' + esc(correct.comment) + '</span>'
          : '') +
        '<div class="tmq-actions"><button class="tmq-btn tmq-btn-sm" type="button" id="tmq-quiz-next">' +
        (chosen.correct ? (state.step < total - 1 ? 'Дальше' : 'К карте уровней') : 'Попробовать снова') +
        '</button></div></div>';
    }

    setBody(
      chapter(CONFIG.route[0].num, CONFIG.route[0].title, (state.step + 1) + ' / ' + total) +
      '<div class="tmq-question">' + esc(item.q) + '</div>' +
      '<div class="tmq-options">' + options + '</div>' +
      feedback
    );

    Array.prototype.forEach.call(dom.body.querySelectorAll('[data-opt]'), function (btn) {
      btn.addEventListener('click', function () {
        if (state.answered) return;
        var idx = Number(btn.getAttribute('data-opt'));
        var isRight = !!(item.options[idx] && item.options[idx].correct);
        state.chosen = idx;
        state.answered = true;

        if (isRight) {
          play('playCorrect');
          beat('quizRight');
          renderQuiz(true);
          return;
        }

        beat('quizWrong');
        var alive = loseLife('Ошибка в факте биографии чемпиона');
        if (!alive) return;

        state.answered = false;
        state.chosen = null;

        if (state.step < total - 1) {
          state.step++;
          saveProgress();
          renderQuiz();
        } else {
          finishStage(0);
        }
      });
    });

    var next = dom.body.querySelector('#tmq-quiz-next');
    if (next) {
      next.addEventListener('click', function () {
        var chosenOpt = item.options[state.chosen];
        if (!chosenOpt || !chosenOpt.correct) {
          state.answered = false;
          state.chosen = null;
          renderQuiz(true);
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
          finishStage(0);
        }
      });
    }
  }

  /* ==========================================================
     VII. ЗАДАЧИ
     ========================================================== */
  function renderPuzzle(kind, isBack) {
    if (!isBack) pushNav({ s: kind, step: state.step });
    state.screen = kind;
    var q = state.quest;
    var list = q[kind];
    var item = list[state.step];
    if (!item) { finishStage(kind === 'attack' ? 1 : 2); return; }

    var route = kind === 'attack' ? CONFIG.route[1] : CONFIG.route[2];
    var turnLabel = String(item.fen).split(' ')[1] === 'b' ? 'Ход чёрных' : 'Ход белых';

    setBody(
      chapter(route.num, route.title, (state.step + 1) + ' / ' + list.length) +
      '<div class="tmq-question">' + esc(item.task) + '</div>' +
      '<div class="tmq-sides">' + turnLabel + ' · нажмите фигуру, затем поле</div>' +
      '<div class="tmq-board-host"><div class="tmq-board-mount" id="tmq-board"></div></div>' +
      '<div id="tmq-puzzle-fb"></div>'
    );

    var host = dom.body.querySelector('#tmq-board');
    state.board = createBoard(host, item.fen, {
      solution: { from: item.from, to: item.to },
      onResult: function (ok) {
        if (ok) {
          play('playCorrect');
          beat('puzzleOk');
          var fb = dom.body.querySelector('#tmq-puzzle-fb');
          if (!fb) return;
          fb.innerHTML = '<div class="tmq-feedback is-ok"><b>Точный ход!</b> ' + esc(item.why) +
            '<div class="tmq-actions"><button class="tmq-btn tmq-btn-sm" type="button" id="tmq-puzzle-next">' +
            (state.step < list.length - 1 ? 'Дальше' : 'К карте уровней') + '</button></div></div>';
          var next = fb.querySelector('#tmq-puzzle-next');
          next.addEventListener('click', function () {
            play('playMove');
            if (state.step < list.length - 1) {
              state.step++;
              saveProgress();
              renderPuzzle(kind);
            } else {
              finishStage(kind === 'attack' ? 1 : 2);
            }
          });
        } else {
          beat('puzzleNo');
          loseLife('Неверный ход в тактической задаче');
        }
      }
    });
  }

  /* ==========================================================
     VIII. ПОЕДИНКИ
     ========================================================== */
  function renderDuel(isBack) {
    if (!isBack) pushNav({ s: 'duels' });
    state.screen = 'duels';
    state.battle = null;
    var q = state.quest;
    var duel = q.duels[state.duelIdx];
    if (!duel) { finishStage(3); return; }

    var oppCard = (typeof HERO_STATS_DATA !== 'undefined' && HERO_STATS_DATA)
      ? (HERO_STATS_DATA[duel.enemyId] || null)
      : null;
    var oppSkill = {
      name: oppCard ? (oppCard.skillName || '') : '',
      tip: oppCard ? (oppCard.tip || '') : ''
    };

    setBody(
      chapter(CONFIG.route[3].num, CONFIG.route[3].title, (state.duelIdx + 1) + ' / ' + q.duels.length) +
      '<div class="tmq-opp-card">' +
        '<div class="tmq-opp-head">' +
          avatarHtml({ name: duel.name, avatar: duel.avatar, color: '#8fb8d8' }, 'is-opp') +
          '<div class="tmq-opp-meta">' +
            '<div class="tmq-opp-role">Соперник эпохи</div>' +
            '<div class="tmq-opp-name">' + esc(duel.name) + '</div>' +
            '<div class="tmq-opp-title">' + esc(duel.years || '') + '</div>' +
          '</div>' +
        '</div>' +
        (duel.quote ? '<blockquote class="tmq-opp-quote">' + esc(duel.quote) + '</blockquote>' : '') +
        (duel.story ? '<p class="tmq-opp-story">' + esc(duel.story) + '</p>' : '') +
        (duel.fact
          ? '<div class="tmq-opp-fact">' +
              '<span class="tmq-opp-fact-label">Интересный факт</span>' +
              '<p>' + esc(duel.fact) + '</p>' +
            '</div>'
          : '') +
        (oppSkill.name
          ? '<div class="tmq-opp-skill">' +
              '<span class="tmq-opp-skill-label">Коронный ход</span>' +
              '<span class="tmq-opp-skill-name">' + esc(oppSkill.name) + '</span>' +
              (oppSkill.tip ? '<span class="tmq-opp-skill-tip">' + esc(oppSkill.tip) + '</span>' : '') +
            '</div>'
          : '') +
        (duel.style ? '<div class="tmq-opp-style">' + esc(duel.style) + '</div>' : '') +
      '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-duel-start">Выйти на арену</button>'
    );

    dom.body.querySelector('#tmq-duel-start').addEventListener('click', beginDuel);
  }

  function statVal(hero, label, dflt) {
    if (!hero || !hero.stats || !hero.stats.length) return dflt;
    for (var i = 0; i < hero.stats.length; i++) {
      if (String(hero.stats[i].name).toLowerCase() === String(label).toLowerCase()) {
        var v = Number(hero.stats[i].val);
        return isNaN(v) ? dflt : v;
      }
    }
    return dflt;
  }

  function beginDuel() {
    if (state.busy || state.inBattle) return;
    var duel = state.quest.duels[state.duelIdx];
    if (!duel) return;

    if (typeof NetDuel !== 'undefined' && NetDuel && typeof NetDuel.startQuestDuel === 'function') {
      state.busy = true;
      state.inBattle = true;
      updateBack();

      var btn = dom.body.querySelector('#tmq-duel-start');
      if (btn) { btn.disabled = true; btn.textContent = 'Бой идёт...'; }

      hideQuestForBattle();
      showNetExit();

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

      if (started && NetDuel.enemyHero && duel.avatar) {
        NetDuel.enemyHero.img = duel.avatar;
        if (state.hero && state.hero.avatar && NetDuel.myHero) {
          NetDuel.myHero.img = state.hero.avatar;
        }
        if (typeof NetDuel.updateHUD === 'function') {
          try { NetDuel.updateHUD(); } catch (e) {}
        }
      }

      if (!started) {
        state.inBattle = false;
        state.busy = false;
        restoreQuestAfterBattle();
        if (btn) { btn.disabled = false; btn.textContent = 'Выйти на арену'; }
        startMiniDuel(duel);
      }
      return;
    }

    startMiniDuel(duel);
  }

  function hideQuestForBattle() {
    if (!dom) return;
    dom.overlay.classList.remove('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'true');
  }

  function restoreQuestAfterBattle() {
    removeNetExit();
    if (!dom) return;
    dom.overlay.classList.add('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'false');
    if (typeof HpFx !== 'undefined' && HpFx.refresh) HpFx.refresh();
  }

  function showNetExit() {
    var overlay = document.getElementById('net-battle-overlay');
    if (!overlay) return;

    var host = overlay.querySelector('.duel-center-content') || overlay;
    var old = document.getElementById('tmq-net-exit');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    var btn = document.createElement('button');
    btn.id = 'tmq-net-exit';
    btn.type = 'button';
    btn.className = 'tmq-net-exit';
    btn.textContent = 'Выйти из боя';

    var armed = false;
    var timer = 0;

    btn.addEventListener('click', function () {
      if (!armed) {
        armed = true;
        btn.classList.add('is-armed');
        btn.textContent = 'Нажмите ещё раз, чтобы выйти';
        clearTimeout(timer);
        timer = setTimeout(function () {
          armed = false;
          btn.classList.remove('is-armed');
          btn.textContent = 'Выйти из боя';
        }, 3200);
        return;
      }
      clearTimeout(timer);
      exitNetDuel();
    });

    host.appendChild(btn);
  }

  function removeNetExit() {
    var btn = document.getElementById('tmq-net-exit');
    if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
  }

  function exitNetDuel() {
    removeNetExit();

    if (typeof NetDuel !== 'undefined' && NetDuel) {
      NetDuel.questHook = null;
      NetDuel.lastOutcome = null;
      try {
        if (NetDuel.ws) { NetDuel.ws.close(); NetDuel.ws = null; }
      } catch (e) {}
      try {
        if (typeof InteractiveBoardEngine !== 'undefined' && InteractiveBoardEngine.stopTimer) {
          InteractiveBoardEngine.stopTimer();
        }
      } catch (e) {}
    }

    var overlay = document.getElementById('net-battle-overlay');
    if (overlay) overlay.style.display = 'none';
    var vm = document.getElementById('duel-victory-modal');
    if (vm) vm.classList.remove('active');

    state.inBattle = false;
    state.busy = false;
    state.battle = null;
    restoreQuestAfterBattle();
    play('click');
    beat('back');
    renderDuel(true);
  }

  function startMiniDuel(duel) {
    state.inBattle = true;
    state.busy = true;
    state.battle = {
      php: 50, ehp: 50, maxHp: 50,
      charge: 1, guard: false, over: false, busy: false,
      pAtk: statVal(state.hero, 'Атака', 7),
      pDef: statVal(state.hero, 'Защита', 7),
      eAtk: 6 + state.duelIdx,
      log: ['Арена вспыхивает. ' + duel.name + ' выходит навстречу.']
    };
    renderBattle();
    beat('duelStart');
  }

  function battleHpBar(value, max, cls) {
    var pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
    return '<div class="tmq-hpbar"><i class="' + cls + '" style="width:' + pct + '%"></i></div>';
  }

  function renderBattle() {
    var b = state.battle;
    if (!b) return;
    var duel = state.quest.duels[state.duelIdx] || {};
    var hero = state.hero || {};

    var tail = b.log.slice(-3).map(function (l) { return '<div>' + esc(l) + '</div>'; }).join('');

    setBody(
      chapter(CONFIG.route[3].num, CONFIG.route[3].title, (state.duelIdx + 1) + ' / ' + state.quest.duels.length) +
      '<div class="tmq-fighter" id="tmq-foe">' +
        avatarHtml({ name: duel.name, avatar: duel.avatar, color: '#8fb8d8' }, 'is-opp') +
        '<div class="tmq-fighter-body">' +
          '<div class="tmq-fighter-top"><span>' + esc(duel.name) + '</span><b>' + b.ehp + '/50</b></div>' +
          battleHpBar(b.ehp, b.maxHp, 'is-enemy') +
          (duel.quote ? '<div class="tmq-fighter-quote">' + esc(duel.quote) + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="tmq-fighter" id="tmq-me">' +
        avatarHtml(hero, 'is-sm') +
        '<div class="tmq-fighter-body">' +
          '<div class="tmq-fighter-top"><span>' + esc(hero.name || 'Вы') + '</span><b>' + b.php + '/50</b></div>' +
          battleHpBar(b.php, b.maxHp, 'is-player') +
        '</div>' +
      '</div>' +
      '<div class="tmq-log">' + tail + '</div>' +
      '<div class="tmq-deck">' +
        '<button class="tmq-btn" type="button" data-act="attack"' + (b.busy || b.over ? ' disabled' : '') + '>Атака</button>' +
        '<button class="tmq-btn tmq-btn-ghost" type="button" data-act="defend"' + (b.busy || b.over ? ' disabled' : '') + '>Защита</button>' +
        '<button class="tmq-btn tmq-btn-cyan" type="button" data-act="skill"' + (b.busy || b.over || b.charge < 2 ? ' disabled' : '') + '>Коронный ход · ' + b.charge + '/2</button>' +
      '</div>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm tmq-flee" type="button" data-act="flee">Выйти из боя</button>'
    );

    Array.prototype.forEach.call(dom.body.querySelectorAll('[data-act]'), function (btn) {
      btn.addEventListener('click', function () {
        battleAct(btn.getAttribute('data-act'));
      });
    });
  }

  function spawnDmg(side, amount, isCrit) {
    if (!dom || !dom.body) return;
    var host = dom.body.querySelector(side === 'foe' ? '#tmq-foe' : '#tmq-me');
    if (!host) return;

    var rect = host.getBoundingClientRect();
    var box = dom.body.getBoundingClientRect();

    var el = document.createElement('div');
    el.className = 'tmq-dmg' + (isCrit ? ' is-crit' : '') + (side === 'me' ? ' is-hurt' : '');
    el.textContent = (isCrit ? '' : '−') + amount;
    el.style.left = Math.round(rect.left - box.left + rect.width * 0.62) + 'px';
    el.style.top = Math.round(rect.top - box.top + rect.height * 0.35) + 'px';

    dom.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1150);
  }

  function exitMiniDuel() {
    state.battle = null;
    state.inBattle = false;
    state.busy = false;
    play('click');
    beat('back');
    renderDuel(true);
  }

  function battleAct(kind) {
    var b = state.battle;
    if (kind === 'flee') { exitMiniDuel(); return; }
    if (!b || b.over || b.busy) return;

    b.busy = true;
    var dmg;

    if (kind === 'attack') {
      dmg = 6 + Math.round(b.pAtk / 2) + rand(0, 2);
      b.ehp = Math.max(0, b.ehp - dmg);
      b.charge = Math.min(2, b.charge + 1);
      b.log.push('Вы атакуете: −' + dmg + ' HP.');
      play('playMove');
    } else if (kind === 'defend') {
      b.guard = true;
      b.charge = Math.min(2, b.charge + 1);
      b.log.push('Вы закрываетесь: следующий удар слабее, заряд +1.');
      play('click');
    } else {
      if (b.charge < 2) {
        b.log.push('Коронный ход ещё не готов: нужно два заряда.');
        b.busy = false;
        renderBattle();
        return;
      }
      b.charge = 0;
      dmg = 14 + b.pAtk;
      b.ehp = Math.max(0, b.ehp - dmg);
      b.log.push('КОРОННЫЙ ХОД: −' + dmg + ' HP!');
      play('playCorrect');
    }

    renderBattle();
    if (typeof dmg === 'number' && dmg > 0) spawnDmg('foe', dmg, kind === 'skill');

    if (b.ehp <= 0) {
      b.over = true;
      b.log.push('Соперник повержен.');
      setTimeout(function () { finishBattle('win'); }, 520);
      return;
    }

    setTimeout(enemyTurn, 620);
  }

  function enemyTurn() {
    var b = state.battle;
    if (!b || b.over) return;

    var dmg = 5 + Math.round(b.eAtk / 2) + rand(0, 2);
    if (b.guard) {
      dmg = Math.max(2, Math.round(dmg / 2));
      b.guard = false;
    }
    b.php = Math.max(0, b.php - dmg);
    b.log.push('Соперник отвечает: −' + dmg + ' HP.');
    play('playWrong');

    b.busy = false;
    renderBattle();
    spawnDmg('me', dmg, false);

    if (b.php <= 0) {
      b.over = true;
      b.log.push('Вы не удержались.');
      setTimeout(function () { finishBattle('lose'); }, 520);
    }
  }

  function finishBattle(outcome) {
    var b = state.battle;
    if (b) b.over = true;
    state.inBattle = false;
    state.busy = false;
    handleDuelResult(outcome);
  }

  function handleDuelResult(outcome) {
    var duel = state.quest.duels[state.duelIdx] || {};

    if (outcome === 'win' || outcome === true) {
      var wonNow = state.duelIdx;
      var totalNow = state.quest.duels.length;
      var isLast = wonNow >= totalNow - 1;

      if (isLast) play('fanfareBig');
      else play('playCorrect');

      beat(isLast ? 'duelWinLast' : 'duelWin');

      after(isLast ? 1100 : 700, function () {
        if (state.screen !== 'duels') return;
        if (!isLast) {
          state.duelIdx = wonNow + 1;
          saveProgress();
        }
        renderCongrats('duel', {
          name: duel.name,
          duel: duel,
          idx: wonNow,
          total: totalNow,
          last: isLast,
          next: function () {
            if (isLast) finishStage(3);
            else renderDuel();
          }
        });
      });
      return;
    }

    var alive = loseLife('Поражение в поединке против ' + (duel.name || 'соперника'));
    if (!alive) return;

    state.battle = null;
    renderDefeat(duel, outcome);
  }

  /* ==========================================================
     IX. ЭКРАН ПОРАЖЕНИЯ
     ========================================================== */
  var TAUNTS = window.QUEST_RIVAL_TAUNTS || {};

  var TAUNTS_GENERIC = [
    '«В следующий раз думайте дольше. Или быстрее — кому как повезёт»',
    '«Позиция была равна. Ровно до вашего хода»',
    '«Я не выиграл. Вы помогли»',
    '«Хорошая попытка. Попытка — не победа»',
    '«За доской говорят фигуры. Ваши молчали»'
  ];

  var LOSS = window.QUEST_RIVAL_LOSS || {};

  var LOSS_GENERIC = [
    '«Хорошая партия. Не скажу, что мне приятно это говорить»',
    '«Вы играли лучше. В следующий раз я буду готовиться иначе»',
    '«Позиция была равной. Потом она перестала быть равной»',
    '«За доской говорят фигуры. Ваши сказали больше»'
  ];

  function tauntFor(duel) {
    var list = duel && TAUNTS[duel.name];
    if (list && list.length) return pick(list);
    return pick(TAUNTS_GENERIC);
  }

  function lossLineFor(duel) {
    var list = duel && LOSS[duel.name];
    if (list && list.length) return pick(list);
    return pick(LOSS_GENERIC);
  }

  function renderDefeat(duel, outcome) {
    state.screen = 'defeat';
    pushNav({ s: 'defeat' });
    var isDraw = outcome === 'draw';

    setBody(
      '<div class="tmq-defeat">' +
        '<div class="tmq-defeat-mark" aria-hidden="true"><span></span><span></span></div>' +
        '<div class="tmq-kicker">' + (isDraw ? 'Ничья · поединок не зачтён' : 'Поединок проигран') + '</div>' +
        '<h2 class="tmq-defeat-title">' + (isDraw ? 'Никто не уступил' : 'Он оказался сильнее') + '</h2>' +
        '<div class="tmq-defeat-card">' +
          avatarHtml({ name: duel.name, avatar: duel.avatar, color: '#8fb8d8' }, 'is-opp') +
          '<div class="tmq-defeat-meta">' +
            '<div class="tmq-defeat-name">' + esc(duel.name) + '</div>' +
            '<div class="tmq-defeat-years">' + esc(duel.years || '') + '</div>' +
          '</div>' +
        '</div>' +
        '<blockquote class="tmq-defeat-quote">' + esc(tauntFor(duel)) + '</blockquote>' +
        '<p class="tmq-defeat-note">' +
          'Одна жизнь потеряна, но эпоха ещё не закрылась. Позицию можно переиграть — соперник будет тот же.' +
        '</p>' +
      '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-retry">Попробовать снова</button>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-defeat-map">К карте уровней</button>'
    );

    beat('duelLose');

    dom.body.querySelector('#tmq-retry').addEventListener('click', function () {
      play('playMove');
      renderDuel();
    });
    dom.body.querySelector('#tmq-defeat-map').addEventListener('click', function () {
      play('click');
      renderMap();
    });
  }

  /* ==========================================================
     X. ФИНАЛ
     ========================================================== */
  function renderFinal(isBack) {
    if (!isBack) pushNav({ s: 'final' });
    state.screen = 'final';
    var q = state.quest;

    setBody(
      chapter(CONFIG.route[4].num, CONFIG.route[4].title, 'Последний рубеж') +
      '<div class="tmq-keeper">' +
        avatarHtml({ name: 'Хранитель времени', avatar: CONFIG.timekeeperAvatar }, 'is-keeper') +
      '</div>' +
      '<a class="tmq-bot-link is-epic" href="' + esc(CONFIG.botUrl) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="tmq-bot-link-halo" aria-hidden="true"></span>' +
        '<span class="tmq-bot-link-body">' +
          '<span class="tmq-bot-link-kicker">Финальный поединок</span>' +
          '<span class="tmq-bot-link-title">Вызвать Хранителя</span>' +
          '<span class="tmq-bot-link-url">' + esc(String(CONFIG.botUrl).replace(/^https?:\/\//, '')) + '</span>' +
        '</span>' +
      '</a>' +
      '<div class="tmq-bot-note">Откроется в новой вкладке. Сыграйте партию — и возвращайтесь сюда.</div>' +
      '<div class="tmq-judge">' +
        '<span class="tmq-judge-label">После победы</span>' +
        '<p>Вернитесь к судье турнира и назовите имя, под которым вы сражались с Хранителем. ' +
          'Он сверит его со списком и вручит вам последний ключ — слово или фразу, ' +
          'которую знает только он. С этого ключа эпоха отпустит вас домой.</p>' +
      '</div>' +
      '<div class="tmq-secret">' +
        '<label class="tmq-secret-label" for="tmq-word">Слово хранителя</label>' +
        '<div class="tmq-secret-row">' +
          '<input class="tmq-input tmq-secret-input" type="text" id="tmq-word" ' +
            'placeholder="Спросите у судьи" autocomplete="off" autocapitalize="off" spellcheck="false">' +
          '<button class="tmq-cta tmq-secret-btn" type="button" id="tmq-win">Подтвердить победу</button>' +
        '</div>' +
        '<div class="tmq-err" id="tmq-word-err" hidden>Слово не подошло. Спросите его у судьи турнира.</div>' +
      '</div>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-later">Ещё играю · вернуться к карте</button>'
    );

    beat('final');

    var wordInput = dom.body.querySelector('#tmq-word');
    var wordErr = dom.body.querySelector('#tmq-word-err');

    function confirmWin() {
      var raw = wordInput ? wordInput.value : '';
      if (checkWinWord(raw)) {
        if (wordErr) wordErr.hidden = true;
        play('fanfareBig');
        renderVictory();
        return;
      }
      if (wordErr) wordErr.hidden = false;
      play('playWrong');
      if (wordInput) wordInput.focus();
    }

    var winBtn = dom.body.querySelector('#tmq-win');
    if (winBtn) winBtn.addEventListener('click', confirmWin);
    if (wordInput) {
      wordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') confirmWin();
      });
    }

    var later = dom.body.querySelector('#tmq-later');
    if (later) {
      later.addEventListener('click', function () {
        play('click');
        renderMap();
      });
    }
  }

  function renderVictory() {
    state.screen = 'victory';
    resetNav([{ s: 'greet' }, { s: 'map' }]);
    play('fanfareBig');
    beat('victory');

    var q = state.quest;

    setBody(
      '<div class="tmq-triumph">' +
        '<div class="tmq-triumph-rays" aria-hidden="true"></div>' +
        '<div class="tmq-triumph-sparks" aria-hidden="true">' +
          '<i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
        '</div>' +
        '<div class="tmq-triumph-crown" aria-hidden="true">♚</div>' +
        '<div class="tmq-kicker">Хранитель времени повержен</div>' +
        '<h2 class="tmq-triumph-title">Ты прошёл эпоху</h2>' +
        '<p class="tmq-triumph-text">Пять уровней, пять соперников и одна партия, которую ты не отдал. ' +
          esc(q.name) + ' смотрит на тебя с портрета — и, кажется, одобряет.</p>' +
        '<div class="tmq-triumph-seal">' +
          avatarHtml(state.hero || { name: q.name }, 'is-md') +
          '<div class="tmq-triumph-name">' + esc(q.name) + '</div>' +
          '<div class="tmq-triumph-line">Пять уровней · ' + state.lives + ' из ' + CONFIG.maxLives + ' жизней</div>' +
        '</div>' +
      '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-finish">К карточке</button>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-again">К карте уровней</button>'
    );

    var again = dom.body.querySelector('#tmq-again');
    if (again) {
      again.addEventListener('click', function () {
        play('click');
        renderMap();
      });
    }

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
     XI. ЗАВЕРШЕНИЕ УРОВНЯ / ВЫБЫВАНИЕ
     ========================================================== */
  function renderCongrats(kind, opts) {
    state.screen = 'congrats';
    var o = opts || {};
    var isStage = kind === 'stage';
    var route = CONFIG.route[o.index || 0] || {};
    var kicker, title, line;

    if (isStage) {
      kicker = o.kicker || ('Уровень ' + (route.num || '') + ' из V');
      title = o.title || ('Уровень «' + esc(route.title || '') + '» пройден');
      line = o.line || 'Идём дальше.';
    } else if (o.last) {
      kicker = 'Поединок ' + (o.total || 5) + ' из ' + (o.total || 5);
      title = 'Круг замкнулся';
      line = esc(o.name || 'Соперник') + ' повержен. Пять соперников — пять эпох — остались позади.';
    } else {
      kicker = 'Поединок ' + ((o.idx || 0) + 1) + ' из ' + (o.total || 5);
      title = esc(o.name || 'Соперник') + ' повержен';
      line = '';
    }

    state.pending = o.next || null;
    pushNav({ s: 'congrats' });

    setBody(
      '<div class="tmq-done">' +
        '<div class="tmq-done-badge"><i class="tmq-check" aria-hidden="true"></i></div>' +
        '<div class="tmq-kicker">' + kicker + '</div>' +
        '<h2 class="tmq-title">' + title + '</h2>' +
        (line ? '<p class="tmq-done-text">' + line + '</p>' : '') +
        (!isStage && o.duel
          ? '<blockquote class="tmq-concede">' + esc(lossLineFor(o.duel)) +
            '<cite>' + esc(o.duel.name || 'Соперник') + '</cite></blockquote>'
          : '') +
        (o.note ? '<div class="tmq-done-note">' + o.note + '</div>' : '') +
        '<button class="tmq-cta" type="button" id="tmq-done-next">' + (o.cta || 'Дальше') + '</button>' +
      '</div>'
    );

    dom.body.querySelector('#tmq-done-next').addEventListener('click', function () {
      play('click');
      var fn = state.pending;
      state.pending = null;
      if (typeof fn === 'function') fn();
      else renderMap();
    });
  }

  function finishStage(stageIndex) {
    var passed = (typeof stageIndex === 'number') ? stageIndex : state.stage;

    if (passed >= CONFIG.route.length || state.stage > passed) {
      state.step = 0;
      state.answered = false;
      state.chosen = null;
      state.battle = null;
      renderMap();
      return;
    }

    state.stage = Math.min(CONFIG.route.length, passed + 1);
    state.step = 0;
    state.answered = false;
    state.chosen = null;
    state.battle = null;
    saveProgress();

    if (passed === 3) play('fanfareBig');
    else play('playFanfare');

    if (passed === 3) {
      var heroName = (state.hero && state.hero.name) || (state.quest && state.quest.name) || 'Чемпион';
      renderCongrats('stage', {
        index: passed,
        kicker: 'Уровень IV из V',
        title: 'Ты вернул ему корону',
        line: 'Пять соперников позади. ' + esc(heroName) + ' снова тот, кем был, — и это сделал ты.',
        note: '<b>Но ты всё ещё в прошлом.</b> Портал закрылся за спиной, эпоха не отпускает просто так. ' +
              'Открыть её может только Хранитель времени — и он не отдаст ключ без партии. ' +
              'Остался последний уровень: выбраться из прошлого.',
        cta: 'К финальному уровню',
        next: function () { renderMap(); }
      });
      return;
    }

    var lines = [
      'Память чемпиона восстановлена. Теперь ты знаешь, откуда он пришёл.',
      'Сила проснулась. Атака стала инструментом, а не загадкой.',
      'Ты увидел угрозу раньше, чем она родилась.',
      'Пять соперников позади. Круг замкнулся.',
      'Осталась одна партия — и она будет последней.'
    ];

    renderCongrats('stage', {
      index: passed,
      line: lines[passed] || 'Идём дальше.',
      next: function () { renderMap(); }
    });
  }

  function renderGameOver(reason) {
    state.screen = 'gameover';
    resetNav([{ s: 'greet' }]);
    play('playDamageTaken');
    beat('gameover');

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
      clearSaved();
      state.lives = CONFIG.maxLives;
      state.stage = 0;
      state.step = 0;
      state.duelIdx = 0;
      play('playUltimate');
      renderMap();
    });

    dom.body.querySelector('#tmq-close-go').addEventListener('click', close);
  }

  /* ==========================================================
     API
     ========================================================== */
  function open(heroId, opts) {
    ensureDOM();
    bindViewport();
    preloadPieces();
    applyRivalSkills();

    var quest = resolveQuest(heroId);
    if (!quest) {
      console.warn('[TimeMachineQuest] нет данных квеста для карточки:', heroId);
      if (typeof showDuelNotice === 'function') showDuelNotice('Для этой карточки квест ещё не настроен');
      return false;
    }

    state.heroId = quest.id;
    state.hero = findHero(heroId);
    state.quest = quest;
    state.stage = 0;
    state.step = 0;
    state.duelIdx = 0;
    state.lives = CONFIG.maxLives;
    state.nick = '';
    state.tc = '10+5';
    state.busy = false;
    state.inBattle = false;
    state.battle = null;
    state.answered = false;
    state.chosen = null;
    state.pending = null;
    clearTimers();

    var fresh = !!(opts && opts.fresh);
    if (fresh) clearSaved();

    var saved = loadProgress();
    if (saved) {
      if (typeof saved.lives === 'number' && saved.lives >= 0) state.lives = saved.lives;
      if (typeof saved.stage === 'number') state.stage = Math.min(saved.stage, CONFIG.route.length);
      if (typeof saved.step === 'number') state.step = Math.max(0, saved.step);
      if (typeof saved.duelIdx === 'number') state.duelIdx = Math.max(0, Math.min(saved.duelIdx, quest.duels.length - 1));
    }

    resetNav([{ s: 'greet' }]);

    if (typeof stopAllTargetVideosImmediate === 'function') {
      try { stopAllTargetVideosImmediate(); } catch (e) {}
    }

    dom.overlay.classList.add('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('tmq-running');

    unlockAudio();

    if (state.lives <= 0) {
      renderGameOver('Лимит ошибок исчерпан в предыдущей попытке');
    } else {
      renderGreet();
      play('choir');
      beat(state.stage > 0 ? 'resume' : 'open');
    }
    return true;
  }

  function openBio(heroId) {
    var ok = open(heroId);
    if (!ok) return false;
    renderBio();
    beat('bio');
    return true;
  }

  function close() {
    if (!dom) return;
    clearTimers();
    clearWarp();
    dom.overlay.classList.remove('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('tmq-running');
    state.inBattle = false;
    state.battle = null;
    resetNav([]);
    if (typeof stopAllTargetVideosImmediate === 'function') stopAllTargetVideosImmediate();
  }

  window.TimeMachineQuest = {
    open: open,
    start: open,
    openBio: openBio,
    close: close,
    createBoard: createBoard,
    config: CONFIG,
    prologue: PROLOGUE,
    beats: BEATS,
    state: state,
    taunts: TAUNTS,
    tauntFor: function (name) {
      var list = TAUNTS[name];
      return (list && list.length) ? pick(list) : pick(TAUNTS_GENERIC);
    }
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