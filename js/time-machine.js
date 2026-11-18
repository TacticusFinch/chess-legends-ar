/* ==========================================================
   МАШИНА ВРЕМЕНИ — КВЕСТ (v5, классический скрипт)

   Что изменилось против v4:
   1. Приветствие без 3D-canvas: чистая типографика, статичная
      временная шкала, две кнопки — «Прыжок во времени»
      и «Биография чемпиона».
   2. Новый верхний HUD: «город · год», подпись «чемпион · этап»,
      жизни сегментами. Угловые «закорючки» убраны.
   3. Перед каждым этапом — брифинг (renderBriefing): что будет,
      как играть, сколько стоит ошибка.
   4. Доска рисуется компонентом createBoard() — тем же, что
      используется на тактической доске дуэли. Один вид, одна
      палитра (--tmq-sq-light / --tmq-sq-dark).
   5. При выборе фигуры подсвечиваются законные ходы
      (ChessLite.moves → точки и кольца взятия).

   Зависимости:
     js/chess-lite.js  — обязательно
     js/hp-fx.js       — числа урона на арене (этап IV)
     js/quest-data.js  — данные квестов (QUEST_DATA и др.)
     NetDuel.startQuestDuel() — этап IV

   API:
     TimeMachineQuest.open(heroId) / .start(heroId) / .close()
     TimeMachineQuest.createBoard(host, fen, opts) — общая доска
   ========================================================== */
(function () {
  'use strict';

  var CONFIG = {
    dates: '21–22 ноября',
    botName: 'Watson-bot',
    botUrl: 'https://lichess.org/@/Watson-bot',
    maxLives: 10,
    storagePrefix: 'tmq_v5_',
    judgeCode: '2026',
    heroGreeting: 'Ты оживил карточку чемпиона — и она стала дверью в его эпоху.',
    route: [
      {
        key: 'quiz', num: 'I', title: 'Вспомнить всё', sub: 'Биография до чемпионства', glyph: '❖',
        text: 'Факты из жизни чемпиона до того, как он взял корону.',
        brief: [
          ['Что будет', 'Вопросы о пути чемпиона: город, соперник, главная идея.'],
          ['Как отвечать', 'Выберите один вариант — проверка сразу после нажатия.'],
          ['Цена ошибки', 'Неверный ответ — минус одна жизнь. Вопрос можно переиграть.']
        ]
      },
      {
        key: 'attack', num: 'II', title: 'Пробуждение силы', sub: 'Задачи на атаку', glyph: '⚔',
        text: 'Мат в один ход. Фигуры двигаются на доске так же, как в тактической дуэли.',
        brief: [
          ['Что будет', 'Две позиции, где нужно найти мат в один ход.'],
          ['Как играть', 'Нажмите свою фигуру — подсветятся возможные ходы. Затем поле.'],
          ['Цена ошибки', 'Неверный ход — минус одна жизнь. Подсказку можно открыть в любой момент.']
        ]
      },
      {
        key: 'defense', num: 'III', title: 'Скрытая угроза', sub: 'Задачи на защиту', glyph: '⛨',
        text: 'Соперник уже грозит матом. Найдите единственный ход, который спасает позицию.',
        brief: [
          ['Что будет', 'Две позиции, где нужно найти защиту от угрозы.'],
          ['Как играть', 'Подсветка показывает все законные ходы выбранной фигуры.'],
          ['Цена ошибки', 'Неверный ход — минус одна жизнь, попытку можно повторить.']
        ]
      },
      {
        key: 'duels', num: 'IV', title: 'Путь героя', sub: 'Пять дуэлей', glyph: '♞',
        text: 'Настоящая арена NetDuel: 50 HP, атака, защита, коронный ход и тактическая доска на 30 секунд.',
        brief: [
          ['Что будет', 'Пять соперников подряд, у каждого 50 HP.'],
          ['Как играть', 'Атака, защита или скилл. Урон показывается всплывающими числами.'],
          ['Цена ошибки', 'Поражение — минус одна жизнь и повтор рубежа.']
        ]
      },
      {
        key: 'final', num: 'V', title: 'Финальная схватка', sub: 'Хранитель времени', glyph: '♚',
        text: 'Последний рубеж — партия с ботом турнира на Lichess и грамота финалиста.',
        brief: [
          ['Что будет', 'Партия с ботом турнира на Lichess.'],
          ['Как играть', 'Выберите контроль времени, укажите ник, получите грамоту.'],
          ['Цена ошибки', 'Жизни не тратятся: это финальный рубеж.']
        ]
      }
    ]
  };

  /* ==========================================================
     ХУДОЖЕСТВЕННЫЙ ПРОЛОГ
     Раньше лежал отдельным файлом quest-prologue.js — теперь
     внутри движка, чтобы не плодить файлы.

     common.lead  — первая строка, одна на всех
     hook         — драма чемпиона: в чём его ставка
     scene        — погружение: место, год, звуки
     stakes       — что случится, если путь не пройти

     Правится здесь же, вёрстку трогать не нужно.
     ========================================================== */
  var PROLOGUE = {
    common: {
      lead: 'Ты оживил карточку чемпиона — и открыл дверь в его эпоху.',
      tail: 'Пять этапов. Десять жизней. Одна корона, которую нужно вернуть.'
    },
    heroes: {
      steinitz: {
        hook: 'Над ним смеялись в лицо. Он утверждал, что атака без подготовки — самоубийство, что пешечная цепь важнее красивой жертвы и что король — сильная фигура, а не беспомощный старик, которого нужно прятать. Его называли безумцем ровно до того дня, когда он забрал корону.',
        scene: 'Вена, 1886. Кофейня «Куропатка» пахнет молотым кофе и мокрым сукном. За окном гремит конка, газетчики кричат о матче, а на мраморной столешнице перед тобой стоят фигуры. Ты касаешься ладьи — и пальцы вспоминают вес, которого ты никогда не знал.',
        stakes: 'Напротив садится Иоганн Цукерторт — человек, который играет красиво и не прощает ошибок. Проиграешь — и первый чемпион мира так и останется непонятым.'
      },
      lasker: {
        hook: 'Доктор математики, который понял главное: за доской борются не фигуры, а люди. Он искал не лучший ход, а худший характер. Двадцать семь лет он держал корону, потому что умел видеть страх в глазах соперника.',
        scene: 'Берлин, 1894. В кабинете пахнет табаком и остывшим кофе. На столе — недописанная статья по математике, а рядом доска с недоигранной партией. Ты смотришь в зеркало и видишь высокий лоб и внимательный, чуть насмешливый взгляд.',
        stakes: 'Тебе нужно свергнуть Стейница — человека, который считает тебя выскочкой. Он будет играть правильно. Ты будешь играть против него самого.'
      },
      capablanca: {
        hook: 'Он научился играть в четыре года, просто глядя на отца. В двадцать с лишним лет он не проигрывал восемь лет подряд — шестьдесят три партии против сильнейших, и ни одного поражения. Казалось, что за доской сидит машина, которой забыли сказать, что люди ошибаются.',
        scene: 'Гавана, 1921. Воздух густой, как сироп, слышно море и гитару в соседнем дворе. На веранде — плетёные кресла, стакан воды и доска. Ты делаешь ход и понимаешь: ты видишь позицию целиком, будто сверху.',
        stakes: 'Против тебя — Эмануил Ласкер, который держал корону двадцать семь лет. Он умеет ждать. Тебе придётся быть быстрее и чище, чем он.'
      },
      alekhine: {
        hook: 'Он говорил: шахматы — это искусство, и принимал все обязанности, которые искусство налагает. Он ворвался в марафон из тридцати четырёх партий против непобедимого Капабланки и сломал его. А потом умер, так и не отдав корону.',
        scene: 'Буэнос-Айрес, 1927. Зал раскалён, вентиляторы гоняют горячий воздух, зрители стоят в проходах. На сцене — две чашки, графин и доска. Ты садишься, и зал замолкает так, что слышно, как скрипит перо судьи.',
        stakes: 'Тридцать четыре партии. Месяц без права на слабость. Капабланка не проигрывал восемь лет — кто-то должен это закончить.'
      },
      euwe: {
        hook: 'Профессор математики, который стал чемпионом мира, не бросив преподавание. Пока другие готовили дебюты, он строил систему: каждый размен выверен, каждый риск просчитан. И однажды эта система обыграла великого Алехина.',
        scene: 'Амстердам, 1935. Дождь стучит по стеклу, в аудитории пусто, на кафедре — мел и стопка тетрадей. Ты стираешь с доски формулу, садишься за шахматный столик и понимаешь: партия — тоже доказательство.',
        stakes: 'Алехин играет ярко и не боится хаоса. Ты можешь противопоставить ему только одно — безупречную логику. Одна неточность, и теорема рухнет.'
      },
      botvinnik: {
        hook: 'Инженер, который превратил подготовку к партии в лабораторию. Он заставлял секундантов дуть на него сигаретным дымом, чтобы привыкнуть к душным залам. Он проигрывал корону и возвращал её — дважды. Его называли патриархом.',
        scene: 'Москва, 1948. За окном серое утро, в комнате — чертёжные листы, логарифмическая линейка и доска. Пахнет графитом и крепким чаем. Ты берёшь фигуру и чувствуешь: это не игра, это работа.',
        stakes: 'Турнир за вакантную корону. Пять сильнейших, и никто не уступит. Здесь побеждает не вдохновение, а тот, кто лучше подготовился.'
      },
      smyslov: {
        hook: 'Он играл так, что фигуры звучали. Современники говорили: его партии похожи на оркестр, где каждый инструмент знает свою партию. И этот человек с оперным баритоном всерьёз проходил прослушивание в Большой театр.',
        scene: 'Москва, 1957. В квартире тихо, на пианино — раскрытые ноты, на столе — доска. Ты напеваешь вполголоса и вдруг слышишь, как позиция складывается в аккорд: центр, линии, гармония.',
        stakes: 'Против тебя Ботвинник — железный, дисциплинированный, страшный в домашних заготовках. Гармония против силы. Что окажется прочнее?'
      },
      tal: {
        hook: 'Ему было двадцать три, когда он сокрушил железного чемпиона. Он жертвовал фигуры не по расчёту, а по вдохновению, и соперники перестали верить своим вычислениям. «Затащите его в тёмный лес, где два плюс два равно пяти» — это его слова.',
        scene: 'Рига, 1960. Дождь стучит по крыше, на кухне кто-то тихо напевает, на стене — афиша турнира. Ты садишься за доску, и в комнате будто становится жарче. Пальцы сами тянутся к фигуре: жертвовать.',
        stakes: 'Ботвинник умеет гасить пожары. Тебе нужно разжечь такой, который он не потушит. Ошибёшься — сгорит твоя корона.'
      },
      petrosyan: {
        hook: 'Его называли Железным Тиграном и упрекали в скучных партиях. Он отвечал: «Я предпочитаю выиграть скучную партию, чем эффектно проиграть весёлую». Он чувствовал опасность за шесть ходов до того, как она появлялась.',
        scene: 'Москва, 1963. Тихий зал, толстый ковёр, приглушённый свет. Ты замечаешь, что слышишь слишком хорошо, — и выключаешь слуховой аппарат. Мир глохнет. Остаются только фигуры.',
        stakes: 'Ботвинник будет давить. Твоя задача — не выиграть красиво, а не проиграть вообще. Крепость держится до последней пешки.'
      },
      spassky: {
        hook: 'Он мог всё: атаковать в королевском гамбите и защищаться в затяжных позиционных боях. В Рейкьявике он встал и аплодировал своему сопернику после гениальной партии. Рыцарство не мешало ему быть безжалостным.',
        scene: 'Москва, 1969. Сцена, тяжёлые шторы, свет лампы. Зал дышит в спину. Ты открываешь королевский гамбит — дебют, который считали музейным, — и слышишь, как кто-то в партере удивлённо выдыхает.',
        stakes: 'Петросян не оставляет слабостей. Придётся создавать их самому — ценой пешек, темпа и риска.'
      },
      fischer: {
        hook: 'Один человек против целой системы. Он выиграл два претендентских матча со счётом 6:0 — двенадцать партий подряд без единой ничьей. Он не верил в психологию, только в сильные ходы. И он приехал в Рейкьявик за короной.',
        scene: 'Рейкьявик, 1972. Холодный свет, гулкий зал, часы с тяжёлым тиком. Ты садишься и впервые чувствуешь: на тебя смотрит весь мир, и половина этого мира желает тебе проиграть.',
        stakes: 'Спасский — чемпион, который умеет всё. Но ты не приехал за вторым местом. Ничьи не считаются.'
      },
      karpov: {
        hook: 'Его называли Анакондой. Он не атаковал — он сжимал. Отбирал поля, линии, воздух, пока соперник не начинал задыхаться в собственной позиции. Сто шестьдесят выигранных турниров. Ни одного лишнего жеста.',
        scene: 'Москва, 1975. Кабинет, тяжёлые шторы, ровный свет. На столе — часы и стакан чая. Ты делаешь спокойный, скучный на вид ход и видишь, как у соперника дёргается плечо.',
        stakes: 'Тебе досталась корона без матча — и весь мир считает её недоказанной. Её придётся защищать всю жизнь.'
      },
      anand: {
        hook: 'Первый азиатский чемпион мира. Он выигрывал корону во всех форматах, какие придумывала ФИДЕ: в нокауте, в круговом турнире, в матчах. И всё это с репутацией самого быстрого человека за доской.',
        scene: 'Мехико, 2007. Зал большой, воздуха не хватает, зрители обмахиваются программами. Ты делаешь ход быстрее, чем успеваешь подумать, — и понимаешь, что уже видишь продолжение.',
        stakes: 'Крамник, Топалов, Гельфанд — каждый умеет то, чего не умеешь ты. Твоё оружие — скорость мысли.'
      },
      liren: {
        hook: 'Он попал на Турнир претендентов в последний момент — вместо дисквалифицированного игрока. А потом сделал то, что не делал никто: в решающей партии тай-брейка отказался от ничьей и пошёл в добровольную связку ради победы.',
        scene: 'Астана, 2023. Глубокий вечер, зал почти пуст, часы отсчитывают последние секунды. Ты видишь повторение ходов, которое даёт ничью и тишину. И отводишь руку в сторону.',
        stakes: 'Сто классических партий без поражений — это твоя стена. Но стены не выигрывают короны. Нужен один ход, который войдёт в историю.'
      },
      gukesh: {
        hook: 'Семнадцать лет. Самый молодой претендент на корону в истории. Пока сверстники сдавали экзамены, он выигрывал Турнир претендентов в Торонто. Возраст — просто число; за доской говорят фигуры.',
        scene: 'Сингапур, 2024. Кондиционер гудит, экран с трансляцией светится в темноте зала. Ты садишься напротив действующего чемпиона и замечаешь, что руки не дрожат.',
        stakes: 'Дин Лижэнь умеет выжидать. У тебя нет его опыта — но есть хладнокровие, которого не объяснить возрастом.'
      },
      stockfish: {
        hook: 'Он не устаёт, не боится и не блефует. Он видит на сорок ходов вперёд и оценивает позицию числом. Для него человеческий страх — просто шум в дереве перебора вариантов.',
        scene: 'Кремниевая долина, 2020. Серверная гудит вентиляторами, в воздухе пахнет пылью и озоном. На экране ползёт оценка: +M12. Ты понимаешь, что мат неизбежен, и всё равно ищешь ход.',
        stakes: 'Твой соперник — человек, который считает себя сильнейшим. У него есть интуиция. У тебя — точность. Посмотрим, что сильнее.'
      },
      enigma: {
        hook: 'Человек в маске. Он играет на площадях Мадрида против прохожих, выходит на сцену телешоу и садится за доску с чемпионом мира. Никто не знает его лица. Важна только мысль на шестидесяти четырёх клетках.',
        scene: 'Мадрид, 2019. Полдень, площадь, туристы, звон велосипедов. На каменном парапете — доска, рядом шляпа для монет. Ты поднимаешь воротник и садишься напротив незнакомца.',
        stakes: 'Ты играешь не за корону, а за тайну. Проиграешь — и маска останется маской навсегда.'
      },
      kasparov: {
        hook: 'В двадцать два он стал самым молодым чемпионом мира в истории. Двадцать лет он был первым номером планеты. Он играл против людей и против машин — и однажды проиграл машине, чтобы научить людей бояться и мечтать одновременно.',
        scene: 'Москва, 1985. Зал набит, ложи светятся, в прессе шуршат блокноты. Ты делаешь ход, который выглядит ошибкой, и слышишь, как зал ахает.',
        stakes: 'Карпов не проигрывает позиционно. Тебе придётся взорвать позицию — иначе он просто задушит тебя.'
      },
      carlsen: {
        hook: 'Он умеет выжимать победу из сухих, ничейных позиций. Он создаёт проблемы там, где их не должно быть, и заставляет соперника сомневаться в очевидном. Рейтинг 2882 — цифра, которая всё объясняет.',
        scene: 'Дубай, 2021. Прохладный зал, огромный экран, тишина такая, что слышно, как щёлкнули часы. Ты делаешь простой ход и видишь, как соперник начинает думать над тем, над чем думать не должен.',
        stakes: 'Непомнящий играет быстро и дерзко. Но у тебя есть то, чего нет у него: бесконечное терпение камня.'
      }
    }
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
    timers: [],
    pending: null
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
        [261.63, 329.63, 392, 523.25].forEach(function (f, i) { tone(f, i * 0.09, 3.2, 0.1, i % 2 ? 'triangle' : 'sine'); });
        tone(1046.5, 1.1, 1.6, 0.05);
      },
      step: function () { tone(880, 0, 0.13, 0.05, 'triangle', 620); },
      correct: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, i * 0.06, 0.32, 0.1); }); },
      wrong: function () { tone(180, 0, 0.3, 0.14, 'sawtooth', 100); },
      fanfare: function () {
        [392, 523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, i * 0.14, 0.9, 0.09); });
        [523.25, 659.25, 783.99].forEach(function (f) { tone(f, 0.7, 1.5, 0.07); });
      },
      warp: function () {
        init();
        if (!ctx) return;
        tone(170, 0, 1.4, 0.14, 'sawtooth', 44);
        tone(880, 1.2, 0.8, 0.08);
      }
    };
  })();

  function unlockAudio() {
    try {
      if (typeof sfx !== 'undefined' && sfx && typeof sfx.init === 'function') sfx.init();
      Sound.init();
    } catch (e) {}
  }

  function play(name) {
    try {
      unlockAudio();
      if (typeof sfx !== 'undefined' && sfx && typeof sfx[name] === 'function') { sfx[name](); return; }
      var alias = {
        playMove: 'step', playCorrect: 'correct', playWrong: 'wrong',
        playFanfare: 'fanfare', playUltimate: 'choir', playBattleStart: 'warp',
        click: 'step', warp: 'warp', arrival: 'choir', playDamageTaken: 'wrong'
      };
      var key = alias[name] || name;
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

  function rand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

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
    try {
      localStorage.setItem(storageKey(), JSON.stringify({
        stage: state.stage, step: state.step, duelIdx: state.duelIdx, lives: state.lives
      }));
    } catch (e) {}
  }

  function loadProgress() {
    try {
      var raw = localStorage.getItem(storageKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
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
     ДАННЫЕ КВЕСТА
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

    var story = (window.QUEST_STORY && window.QUEST_STORY[hero.id]) || {};
    var heroName = hero.name || 'Чемпион';
    var eraLabel = eras.era || hero.title || 'эпоха чемпиона';

    var welcome = (story.welcome && story.welcome.length) ? story.welcome : [
      'Ты оживил карточку — и она стала билетом в прошлое. Теперь это не портрет, а дверь в эпоху, где жил и побеждал ' + heroName + '.',
      'Машина времени настроена на ' + eraLabel + '. Впереди пять этапов: память чемпиона, пробуждение силы, скрытая угроза, пять дуэлей и партия с Хранителем времени.',
      'Кристаллы времени уже светятся. Не теряй их зря — и не теряй жизней: их всего десять.'
    ];

    var awake = (story.awake && story.awake.length) ? story.awake : [
      'Вы просыпаетесь в незнакомом месте. Воздух другой: ' + eraLabel + '. Слышно, как идёт чужая жизнь — и она теперь ваша.',
      'Вы с удивлением осознаёте, что оказались в теле будущего чемпиона — ' + heroName + '. Руки помнят вес фигур, а в голове звучит чужая мысль.',
      'Вам предстоит пройти его путь: пять этапов становления и финальная партия с Хранителем времени.'
    ];

    return {
      id: hero.id || heroId,
      name: heroName,
      shortName: heroName.split(' ').pop(),
      era: eraLabel,
      piece: eras.piece || 'king',
      mission: data.mission || 'Пройти пять этапов пути и выстоять в партии с Хранителем времени.',
      welcome: welcome,
      awake: awake,
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
            '<button class="tmq-close" type="button" id="tmq-close" aria-label="Закрыть квест">✕</button>' +
          '</div>' +
        '</header>' +
        '<div class="tmq-body" id="tmq-body"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    dom = {
      overlay: overlay,
      card: overlay.querySelector('.tmq-card'),
      body: overlay.querySelector('#tmq-body'),
      lives: overlay.querySelector('#tmq-lives'),
      city: overlay.querySelector('#tmq-city'),
      year: overlay.querySelector('#tmq-year'),
      headSub: overlay.querySelector('#tmq-head-sub'),
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

  function renderHead() {
    if (!dom) return;
    var q = state.quest || {};
    var era = String(q.era || '');
    var parts = era.split(',');

    dom.city.textContent = (parts[0] || '—').trim();
    dom.year.textContent = (parts[1] || '').trim() || '—';

    var label;
    if (state.stage >= CONFIG.route.length) label = 'финал пройден';
    else label = 'этап ' + CONFIG.route[state.stage].num + ' из V · ' + CONFIG.route[state.stage].title;

    dom.headSub.textContent = (q.name || 'Чемпион') + ' · ' + label;

    var out = '';
    for (var i = 1; i <= CONFIG.maxLives; i++) {
      out += '<i class="tmq-life' + (i <= state.lives ? '' : ' is-off') + '"></i>';
    }
    dom.lives.innerHTML = out + '<b class="tmq-lives-num">' + state.lives + '/' + CONFIG.maxLives + '</b>';
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
    dom.body.innerHTML = html;
    dom.body.scrollTop = 0;
  }

  function clearWarp() {
    if (!dom) return;
    var node = dom.overlay.querySelector('.tmq-warp') || dom.overlay.querySelector('.tmq-warpfull');
    if (node && node.parentNode) node.parentNode.removeChild(node);
    dom.overlay.classList.remove('tmq-warping');
    if (typeof stopWarpFx === 'function') stopWarpFx();
  }

  /* ==========================================================
     ДОСКА — общий компонент (квест + дуэль)
     ========================================================== */
  var GLYPH = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
  };

  function createBoard(host, fen, opts) {
    opts = opts || {};
    var files = 'abcdefgh';
    var curFen = fen;
    var pos = ChessLite.parse(curFen);
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
          var sq = files[f] + rank;
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
          if (rank === 1) cell.appendChild(mkLabel('tmq-lbl-file', files[f]));

          cells[sq] = cell;
          grid.appendChild(cell);
        }
      }
    }

    function clearMarks() {
      for (var sq in cells) {
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

      var list = ChessLite.moves(curFen, sq);
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

        var next = ChessLite.apply(curFen, from, to);
        setTimeout(function () {
          curFen = next;
          pos = ChessLite.parse(curFen);
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
          for (var sq in cells) cells[sq].classList.remove('is-bad-from', 'is-bad-to');
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
        var list = ChessLite.moves(curFen, selected);
        for (var i = 0; i < list.length; i++) {
          if (list[i].to === sq) { commit(selected, sq); return; }
        }
      }

      if (piece && ChessLite.colorOf(piece) === pos.turn) { select(sq); return; }
      clearMarks();
    });

    /* [FIX] Доска получает явную высоту по ширине контейнера.
       Раньше высоту задавал только aspect-ratio, и в мобильном Safari
       внутри flex-колонки с overflow она схлопывалась в 0 — доска
       «исчезала» именно в этапах II и III. */
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
        pos = ChessLite.parse(f);
        locked = false;
        clearMarks();
        paint();
        syncSize();
      },
      resize: syncSize,
      destroy: function () { host.innerHTML = ''; }
    };
  }

  /* ==========================================================
     I. ПРИВЕТСТВИЕ — визитная карточка приключения
     Художественный пролог берётся из js/quest-prologue.js:
       lead   — завязка турнира
       hook   — драма чемпиона
       scene  — погружение в эпоху
       stakes — ставка пути
     ========================================================== */
  function prologueFor() {
    var q = state.quest || {};
    var hero = state.hero || {};

    /* Тексты живут в PROLOGUE внутри этого файла. Если снаружи
       положили window.QUEST_PROLOGUE (например, свой набор для
       турнира) — он имеет приоритет, файл переписывать не нужно. */
    var ext = window.QUEST_PROLOGUE || null;
    var src = (ext && ext.heroes) || PROLOGUE.heroes;
    var common = (ext && ext.common) || PROLOGUE.common;
    var entry = src[hero.id] || src[q.id] || null;

    return {
      lead: common.lead || 'Ты оживил карточку чемпиона — и открыл дверь в его эпоху.',
      hook: (entry && entry.hook) || (q.welcome && q.welcome[0]) || 'Карточка ожила, и время дрогнуло.',
      scene: (entry && entry.scene) || (q.welcome && q.welcome[1]) || 'Воздух другой эпохи уже вокруг тебя.',
      stakes: (entry && entry.stakes) || 'Пять этапов, десять жизней и один финальный поединок. Ошибка стоит жизни — но путь можно пройти заново.',
      tail: common.tail || 'Пять этапов. Десять жизней. Одна корона.'
    };
  }

  function renderGreet() {
    state.screen = 'greet';
    var q = state.quest;
    var p = prologueFor();
    var hero = state.hero || {};
    var accent = hero.color || '#d4b475';
    var glyph = hero.glyph || (q.piece === 'queen' ? '♛' : '♚');

    setBody(
      '<div class="tmq-welcome">' +
        '<div class="tmq-kicker">Турнир · ' + esc(CONFIG.dates) + '</div>' +
        '<h2 class="tmq-welcome-title">Добро пожаловать<br>на турнир «Машина времени»</h2>' +
        '<div class="tmq-cover" style="--tmq-accent: ' + esc(accent) + ';">' +
          '<div class="tmq-cover-glyph" aria-hidden="true">' + glyph + '</div>' +
          '<div class="tmq-cover-meta">' +
            '<span class="tmq-cover-era">' + esc(q.era) + '</span>' +
            '<span class="tmq-cover-name">' + esc(q.name) + '</span>' +
            '<span class="tmq-cover-title">' + esc(hero.title || 'Чемпион мира по шахматам') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="tmq-story">' +
          '<p class="is-lead">' + esc(p.lead) + '</p>' +
          '<p>' + esc(p.hook) + '</p>' +
          '<p>' + esc(p.scene) + '</p>' +
          '<p>' + esc(p.stakes) + '</p>' +
        '</div>' +
        '<div class="tmq-stakes">' +
          '<span><b>5</b> этапов</span>' +
          '<span><b>' + CONFIG.maxLives + '</b> жизней</span>' +
          '<span><b>' + q.duels.length + '</b> дуэлей</span>' +
        '</div>' +
        '<button class="tmq-cta" type="button" id="tmq-jump">Прыжок во времени <span aria-hidden="true">→</span></button>' +
        '<button class="tmq-link" type="button" id="tmq-bio">Биография чемпиона</button>' +
      '</div>'
    );

    dom.body.querySelector('#tmq-bio').addEventListener('click', function () {
      play('click');
      renderBio();
    });
    dom.body.querySelector('#tmq-jump').addEventListener('click', function () {
      play('warp');
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
      '<div class="tmq-copy">' +
        (bio.length
          ? bio.map(function (s) {
              return '<p><strong>' + esc(s.title) + '</strong><br>' + esc(s.text) + '</p>';
            }).join('')
          : '<p>Биография этой карточки ещё не заполнена.</p>') +
      '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-bio-next">Прыжок во времени <span aria-hidden="true">→</span></button>'
    );

    dom.body.querySelector('#tmq-bio-back').addEventListener('click', renderGreet);
    dom.body.querySelector('#tmq-bio-next').addEventListener('click', function () {
      play('warp');
      renderWarp();
    });
  }

  /* ==========================================================
     II. ВАРП-ПРЫЖОК — зрелищная последовательность

     Слои: canvas-звёзды (разгон из центра), световое ядро,
     три расходящихся кольца, диагональные лучи, панель с
     названием эпохи, шкала перехода и вспышка на выходе.
     Всё рисуется 2,6 секунды, затем экран «Вы проснулись».
     ========================================================== */
  var WarpFx = { raf: 0, alive: false, skipped: false };

  function stopWarpFx() {
    WarpFx.alive = false;
    if (WarpFx.raf) {
      cancelAnimationFrame(WarpFx.raf);
      WarpFx.raf = 0;
    }
  }

  /* [FIX] Качество варпа подбирается под устройство.
     Слабые телефоны получают меньше частиц, DPR 1 и потолок
     разрешения canvas — иначе браузер подвисает на старте. */
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
    var warp = document.createElement('div');
    warp.className = 'tmq-warp';
    warp.innerHTML =
      '<canvas class="tmq-warp-stars" id="tmq-warp-stars"></canvas>' +
      '<div class="tmq-warp-glow"></div>' +
      '<div class="tmq-warp-rings"><i></i><i></i><i></i></div>' +
      '<div class="tmq-warp-beams"><i></i><i></i><i></i></div>' +
      '<div class="tmq-warp-panel">' +
        '<div class="tmq-warp-label">ВАРП-ПРЫЖОК</div>' +
        '<div class="tmq-warp-target">' + esc(q.era) + '</div>' +
        '<div class="tmq-warp-progress"><i></i></div>' +
        '<div class="tmq-warp-status" id="tmq-warp-status">стабилизация канала</div>' +
      '</div>' +
      '<div class="tmq-warp-skip">нажмите, чтобы пропустить</div>' +
      '<div class="tmq-warp-flash"></div>';

    dom.overlay.appendChild(warp);
    dom.overlay.classList.add('tmq-warping');

    WarpFx.skipped = false;
    startWarpStars(warp.querySelector('#tmq-warp-stars'));

    var status = warp.querySelector('#tmq-warp-status');

    /* Выход из варпа в одном месте: и по таймеру, и по касанию.
       Даже если canvas на слабом устройстве не отрисуется,
       сцена гарантированно закончится за 2,2 секунды. */
    function finishWarp() {
      if (WarpFx.skipped) return;
      WarpFx.skipped = true;
      clearTimers();
      stopWarpFx();
      state.stage = Math.max(state.stage, 0);
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
     III. «ВЫ ПРОСНУЛИСЬ» И КАРТА ПУТИ
     ========================================================== */
  function renderAwake() {
    state.screen = 'awake';
    var q = state.quest;
    var p = prologueFor();

    /* Если для карточки нет готового «пробуждения» — собираем из пролога,
       чтобы у всех 19 чемпионов была полноценная сцена, а не заглушка. */
    var lines = (q.awake && q.awake.length) ? q.awake : [
      p.scene,
      'Ты делаешь вдох — и понимаешь, что дышишь чужими лёгкими. Это тело чемпиона, и оно помнит вес фигур лучше, чем ты помнишь собственное имя.',
      'Впереди пять этапов. Первый — память: без неё сила не проснётся.'
    ];

    setBody(
      '<div class="tmq-awake">' +
        '<div class="tmq-kicker">' + esc(q.era) + '</div>' +
        '<h2 class="tmq-awake-title">Вы проснулись.</h2>' +
        '<div class="tmq-copy tmq-copy-quote">' +
          lines.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
        '</div>' +
        '<button class="tmq-cta" type="button" id="tmq-map">Карта пути <span aria-hidden="true">→</span></button>' +
      '</div>'
    );

    dom.body.querySelector('#tmq-map').addEventListener('click', function () {
      play('click');
      renderMap(false);
    });
  }

  function renderMap() {
    state.screen = 'map';
    var q = state.quest;
    var current = state.stage;

    var cards = CONFIG.route.map(function (item, i) {
      var status = i < current ? 'done' : i === current ? 'active' : 'locked';
      var label = status === 'done' ? 'Пройдено' : status === 'active' ? 'Сейчас' : 'Впереди';
      var meta = item.key === 'quiz' ? q.quiz.length + ' вопроса'
        : item.key === 'attack' ? q.attack.length + ' задачи'
        : item.key === 'defense' ? q.defense.length + ' задачи'
        : item.key === 'duels' ? q.duels.length + ' дуэлей'
        : 'Lichess';

      return '<article class="tmq-route ' + status + '">' +
        '<div class="tmq-rail"><span class="tmq-node">' + (status === 'done' ? '✓' : esc(item.num)) + '</span>' +
        '<span class="tmq-rail-line"></span></div>' +
        '<div class="tmq-route-body">' +
          '<div class="tmq-route-top"><span class="tmq-route-glyph">' + item.glyph + '</span>' +
          '<span class="tmq-route-status">' + label + '</span></div>' +
          '<div class="tmq-route-title">' + esc(item.title) + '</div>' +
          '<div class="tmq-route-sub">' + esc(item.sub) + ' · ' + esc(meta) + '</div>' +
          (status === 'active'
            ? '<button class="tmq-btn tmq-btn-sm" type="button" data-enter="' + i + '">Войти на этап</button>'
            : '') +
        '</div>' +
      '</article>';
    }).join('');

    setBody(
      chapter('···', 'Карта пути', q.era) +
      '<div class="tmq-title">Пять этапов становления</div>' +
      '<div class="tmq-copy"><p class="is-lead">' + esc(q.mission) + '</p></div>' +
      '<div class="tmq-route-list">' + cards + '</div>' +
      '<div class="tmq-fineprint">Ошибка −1 ♥ · поражение в дуэли −1 ♥ и повтор рубежа</div>'
    );

    var buttons = dom.body.querySelectorAll('[data-enter]');
    Array.prototype.forEach.call(buttons, function (btn) {
      btn.addEventListener('click', function () {
        play('playMove');
        renderBriefing(Number(btn.getAttribute('data-enter')));
      });
    });
  }

  /* ==========================================================
     IV. БРИФИНГ ПЕРЕД ЭТАПОМ
     ========================================================== */
  function renderBriefing(index) {
    state.screen = 'briefing';
    state.stage = index;
    saveProgress();

    var route = CONFIG.route[index];
    if (!route) { renderMap(); return; }

    var rows = (route.brief || []).map(function (row) {
      return '<div class="tmq-brief-row">' +
        '<span class="tmq-brief-key">' + esc(row[0]) + '</span>' +
        '<span class="tmq-brief-val">' + esc(row[1]) + '</span>' +
        '</div>';
    }).join('');

    /* Художественная рамка этапа: одна строка настроения перед правилами */
    var opening = [
      'Память — единственное, что нельзя отнять. Но её можно потерять.',
      'Сила просыпается не в мышцах, а в точном расчёте.',
      'Угроза всегда приходит раньше, чем её замечают.',
      'Пять соперников. Пять эпох. Ни одного права на ошибку.',
      'Часы уже идут.'
    ][index] || '';

    setBody(
      chapter(route.num, route.title, 'перед стартом') +
      '<div class="tmq-title">' + esc(route.title) + '</div>' +
      '<div class="tmq-sub">' + esc(route.sub) + '</div>' +
      '<div class="tmq-copy">' +
        '<p class="is-lead">' + esc(opening) + '</p>' +
        '<p>' + esc(route.text) + '</p>' +
      '</div>' +
      '<div class="tmq-brief">' + rows + '</div>' +
      '<button class="tmq-cta" type="button" id="tmq-start">Начать этап <span aria-hidden="true">→</span></button>' +
      '<button class="tmq-btn tmq-btn-ghost tmq-btn-sm" type="button" id="tmq-back">К карте пути</button>'
    );

    dom.body.querySelector('#tmq-start').addEventListener('click', function () {
      play('playMove');
      state.step = 0;
      state.answered = false;
      state.chosen = null;
      state.missed = false;
      enterStage(route.key);
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
     V. ВОПРОСЫ
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
        (!chosen.correct && correct
          ? '<br><span class="tmq-dimline">Правильный ответ: ' + esc(correct.text) + '. ' + esc(correct.comment) + '</span>'
          : '') +
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
     VI. ЗАДАЧИ НА ДОСКЕ
     ========================================================== */
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
    createBoard(host, item.fen, {
      solution: { from: item.from, to: item.to },
      onResult: function (ok) {
        if (ok) {
          play('playCorrect');
          var fb = dom.body.querySelector('#tmq-puzzle-fb');
          if (!fb) return;
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
        } else {
          state.missed = true;
          loseLife('Неверный ход в тактической задаче');
          if (state.lives <= 0) return;
          var hint = dom.body.querySelector('#tmq-hint');
          if (hint) hint.hidden = false;
        }
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
     VII. ДУЭЛИ ЧЕРЕЗ NetDuel
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
      '<div class="tmq-copy"><p>Дуэль идёт на настоящей арене: 50 HP, атака, защита, коронный ход и тактическая доска. Победа открывает следующий рубеж.</p></div>' +
      '<div class="tmq-log" id="tmq-duel-log">Готовы выйти на арену?</div>' +
      '<button class="tmq-cta" type="button" id="tmq-duel-start">Выйти на арену <span aria-hidden="true">→</span></button>' +
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
    if (typeof HpFx !== 'undefined' && HpFx.refresh) HpFx.refresh();
  }

  function handleDuelResult(outcome) {
    var duel = state.quest.duels[state.duelIdx];
    var log = dom.body.querySelector('#tmq-duel-log');
    var btn = dom.body.querySelector('#tmq-duel-start');

    if (outcome === 'win' || outcome === true) {
      if (log) log.textContent = 'Рубеж взят.';
      play('playCorrect');
      after(800, function () {
        if (state.screen !== 'duels') return;
        var won = state.duelIdx;
        var total = state.quest.duels.length;
        var last = won >= total - 1;
        if (!last) {
          state.duelIdx = won + 1;
          saveProgress();
        }
        renderCongrats('duel', {
          name: duel.name,
          idx: won,
          total: total,
          next: function () {
            if (last) finishStage();
            else renderDuel();
          }
        });
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
     VIII. ФИНАЛ
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
      '<div class="tmq-copy"><p>«Ты прошёл память, атаку, защиту и пятерых хранителей эпох. Осталась партия. Садись — часы уже идут».</p></div>' +
      '<div class="tmq-step"><div class="tmq-step-title">Шаг 1 · профиль бота</div>' +
        '<button class="tmq-btn tmq-btn-cyan" type="button" id="tmq-bot-addr">@' +
        esc(CONFIG.botName) + ' · lichess.org</button>' +
        '<div class="tmq-bot-addr" id="tmq-bot-panel" hidden>' +
          '<span class="tmq-bot-url">' + esc(String(CONFIG.botUrl).replace(/^https?:\/\//, '')) + '</span>' +
          '<span class="tmq-bot-hint">Адрес показан только для чтения: откройте его на судейском устройстве или в отдельном окне. Из приложения переход не выполняется.</span>' +
        '</div></div>' +
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
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') verify(); });

    /* Адрес бота показывается внутри приложения, без перехода наружу */
    var botBtn = dom.body.querySelector('#tmq-bot-addr');
    var botPanel = dom.body.querySelector('#tmq-bot-panel');
    if (botBtn && botPanel) {
      botBtn.addEventListener('click', function () {
        play('click');
        botPanel.hidden = !botPanel.hidden;
        if (!botPanel.hidden && navigator.clipboard && navigator.clipboard.writeText) {
          try {
            navigator.clipboard.writeText(CONFIG.botUrl).catch(function () {});
          } catch (e) {}
        }
      });
    }
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
      '<button class="tmq-btn tmq-btn-ghost" type="button" id="tmq-cert-toggle">Текст грамоты</button>' +
      '<pre class="tmq-cert" id="tmq-cert" hidden>' + esc(certificate) + '</pre>' +
      '<button class="tmq-btn tmq-btn-ghost" type="button" id="tmq-download">Скачать файлом</button>' +
      '<button class="tmq-cta" type="button" id="tmq-finish">К карточке <span aria-hidden="true">→</span></button>'
    );

    /* Грамота всегда доступна текстом — выгрузка файла лишь дополнение */
    var certToggle = dom.body.querySelector('#tmq-cert-toggle');
    var certNode = dom.body.querySelector('#tmq-cert');
    if (certToggle && certNode) {
      certToggle.addEventListener('click', function () {
        play('click');
        certNode.hidden = !certNode.hidden;
        certToggle.textContent = certNode.hidden ? 'Текст грамоты' : 'Скрыть текст';
      });
    }

    dom.body.querySelector('#tmq-download').addEventListener('click', function () {
      try {
        var blob = new Blob([certificate], { type: 'text/plain;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'gramota-' + q.id + '.txt';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      } catch (e) {
        if (certNode) certNode.hidden = false;
        if (certToggle) certToggle.textContent = 'Скрыть текст';
        if (typeof showDuelNotice === 'function') showDuelNotice('Файл недоступен — текст грамоты открыт выше');
      }
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
     IX. ЗАВЕРШЕНИЕ ЭТАПА / ВЫБЫВАНИЕ
     ========================================================== */
  var STAGE_LINES = [
    'Память чемпиона восстановлена. Теперь вы знаете, откуда он пришёл.',
    'Сила проснулась. Атака стала инструментом, а не загадкой.',
    'Вы увидели угрозу раньше, чем она появилась.',
    'Пять соперников позади. Путь героя пройден.'
  ];

  function renderCongrats(kind, opts) {
    state.screen = 'congrats';
    var o = opts || {};
    var isStage = kind === 'stage';
    var route = CONFIG.route[o.index || 0] || {};
    var kicker, title, line;

    if (isStage) {
      kicker = 'Этап ' + (route.num || '') + ' из V';
      title = esc(route.title || 'Этап') + ' пройден';
      line = o.line || 'Идём дальше.';
    } else {
      kicker = 'Дуэль ' + ((o.idx || 0) + 1) + ' из ' + (o.total || 5);
      title = esc(o.name || 'Соперник') + ' повержен';
      line = 'Рубеж взят. Следующий соперник уже за доской.';
    }

    state.pending = o.next || null;

    setBody(
      '<div class="tmq-done">' +
        '<div class="tmq-done-badge">✓</div>' +
        '<div class="tmq-kicker">' + kicker + '</div>' +
        '<h2 class="tmq-title">' + title + '</h2>' +
        '<p class="tmq-done-text">' + line + '</p>' +
        '<button class="tmq-cta" type="button" id="tmq-done-next">Дальше <span aria-hidden="true">→</span></button>' +
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

  function finishStage() {
    var passed = state.stage;
    state.stage = Math.min(CONFIG.route.length, passed + 1);
    state.step = 0;
    state.answered = false;
    state.chosen = null;
    state.missed = false;
    saveProgress();
    play('playFanfare');
    renderCongrats('stage', {
      index: passed,
      line: STAGE_LINES[passed] || 'Идём дальше.',
      next: function () { renderMap(); }
    });
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
      renderMap();
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
    state.pending = null;
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

    unlockAudio();

    if (state.lives <= 0) {
      renderGameOver('Лимит ошибок исчерпан в предыдущей попытке');
    } else if (state.stage > 0) {
      renderMap();
    } else {
      renderGreet();
      play('choir');
    }
    return true;
  }

  function close() {
    if (!dom) return;
    clearTimers();
    clearWarp();
    dom.overlay.classList.remove('tmq-open');
    dom.overlay.setAttribute('aria-hidden', 'true');
    state.inBattle = false;
    if (typeof stopAllTargetVideosImmediate === 'function') stopAllTargetVideosImmediate();
  }

  window.TimeMachineQuest = {
    open: open,
    start: open,
    close: close,
    createBoard: createBoard,
    config: CONFIG,
    prologue: PROLOGUE,
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