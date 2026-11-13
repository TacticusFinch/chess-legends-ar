/**
 * Тактикус Финч — Модуль Дуэлей на WebSocket Amvera
 * Кинематографичные аркадные эффекты (Floating Dmg, Screen Shake, Super Cut-in, Haptics)
 * Синхронизировано с базой данных чемпионов heroes-data.js (19 легенд)
 */
const AMVERA_WS = "wss://chesslegendsai-tacticusfinch.mia0.amvera.tech";

/* ================= 1. ДВИЖОК ТАКТИЧЕСКОЙ ДОСКИ (ТАПАМИ С ТАЙМЕРОМ 30 СЕК) ================= */
const InteractiveBoardEngine = {
  board: null,
  game: null,
  currentPuzzle: null,
  active: false,
  selectedSquare: null,
  timerInterval: null,
  timeLeftMs: 30000,
  TOTAL_TIME_MS: 30000,

  start() {
    const modal = document.getElementById("tactical-board-modal");
    const descEl = document.getElementById("tactical-task-title");
    const skillTooltip = document.getElementById("battle-skill-tooltip");

    if (skillTooltip) skillTooltip.style.display = "none";
    if (!modal) return;

    modal.style.display = "flex";
    this.active = true;
    this.selectedSquare = null;

    this.currentPuzzle = (typeof getRandomDuelPuzzle === "function")
      ? getRandomDuelPuzzle()
      : {
          fen: "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
          move: { from: "b1", to: "b8" },
          desc: "Найдите лучший ход"
        };

    if (typeof Chess !== "undefined") {
      this.game = new Chess(this.currentPuzzle.fen);
    }

    if (descEl) descEl.textContent = this.currentPuzzle.desc || "Найдите лучший ход";

    this.startTimer();

    setTimeout(() => {
      this.initBoard();
    }, 60);
  },

  startTimer() {
    this.stopTimer();
    this.timeLeftMs = this.TOTAL_TIME_MS;
    this.updateTimerUI();

    const stepMs = 100;
    this.timerInterval = setInterval(() => {
      this.timeLeftMs -= stepMs;

      if (this.timeLeftMs <= 0) {
        this.timeLeftMs = 0;
        this.updateTimerUI();
        this.stopTimer();
        this.onTimeExpired();
      } else {
        this.updateTimerUI();
      }
    }, stepMs);
  },

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  },

  updateTimerUI() {
    const secEl = document.getElementById("tactical-timer-sec");
    const barEl = document.getElementById("tactical-timer-bar");
    const badgeEl = document.getElementById("tactical-timer-badge");

    const seconds = Math.ceil(this.timeLeftMs / 1000);
    const percent = Math.max(0, (this.timeLeftMs / this.TOTAL_TIME_MS) * 100);

    if (secEl) secEl.textContent = seconds;
    if (barEl) {
      barEl.style.width = `${percent}%`;
      // Когда времени мало (< 10 сек) — красивое предупреждение красным цветом
      if (seconds <= 10) {
        barEl.style.backgroundColor = "#ff4d6d";
        if (badgeEl) {
          badgeEl.style.color = "#ff4d6d";
          badgeEl.style.borderColor = "#ff4d6d";
          badgeEl.style.background = "rgba(255, 77, 109, 0.2)";
        }
      } else {
        barEl.style.backgroundColor = "#f1c40f";
        if (badgeEl) {
          badgeEl.style.color = "#f1c40f";
          badgeEl.style.borderColor = "rgba(241, 196, 15, 0.4)";
          badgeEl.style.background = "rgba(241, 196, 15, 0.15)";
        }
      }
    }
  },

  onTimeExpired() {
    if (!this.active) return;
    this.active = false;
    this.removeHighlights();

    const descEl = document.getElementById("tactical-task-title");
    if (descEl) {
      descEl.textContent = "ВРЕМЯ ВЫШЛО!";
      descEl.style.color = "#ff4d6d";
    }

    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    if (navigator.vibrate) navigator.vibrate(250);

    setTimeout(() => {
      const modal = document.getElementById("tactical-board-modal");
      if (modal) modal.style.display = "none";

      const skillTooltip = document.getElementById("battle-skill-tooltip");
      if (skillTooltip) skillTooltip.style.display = "flex";

      // Ход считается неуспешным (атака без крита / со штрафом)
      NetDuel.resolveTacticalStrike(false);
    }, 700);
  },

  initBoard() {
    if (typeof Chessboard === "undefined" || !this.game) return;

    const config = {
      draggable: false,
      position: this.currentPuzzle.fen,
      orientation: this.game.turn() === 'w' ? 'white' : 'black',
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    if (this.board) {
      this.board.destroy();
    }
    this.board = Chessboard('strike-board', config);
    this.bindSquareClicks();
  },

  removeHighlights() {
    if (typeof $ !== "undefined") {
      $('#strike-board .square-55d63').removeClass('highlight-selected highlight-dest highlight-dest-capture');
    }
  },

  bindSquareClicks() {
    if (typeof $ === "undefined" || !this.game) return;

    const self = this;
    const boardEl = $('#strike-board');

    boardEl.off('click touchstart', '.square-55d63');

    boardEl.on('click touchstart', '.square-55d63', function(e) {
      if (!self.active) return;
      e.preventDefault();

      const square = $(this).attr('data-square');
      if (!square) return;

      const pieceOnSquare = self.game.get(square);
      const isMyPiece = pieceOnSquare && pieceOnSquare.color === self.game.turn();

      if (isMyPiece) {
        self.selectedSquare = square;
        self.removeHighlights();
        $(this).addClass('highlight-selected');

        const moves = self.game.moves({ square: square, verbose: true });
        moves.forEach(m => {
          const isCapture = !!self.game.get(m.to);
          const targetEl = $(`#strike-board .square-${m.to}`);
          if (isCapture) {
            targetEl.addClass('highlight-dest-capture');
          } else {
            targetEl.addClass('highlight-dest');
          }
        });

        if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
        return;
      }

      if (self.selectedSquare) {
        const source = self.selectedSquare;
        const target = square;
        const targetMove = self.currentPuzzle.move;

        self.active = false;
        self.stopTimer(); // Останавливаем таймер при ходе
        self.removeHighlights();

        const isCorrect = (source === targetMove.from && target === targetMove.to);

        if (isCorrect) {
          self.game.move({ from: source, to: target });
          if (self.board) self.board.position(self.game.fen());
          self.onSuccess();
        } else {
          self.game.move({ from: source, to: target });
          if (self.board) self.board.position(self.game.fen());
          self.onError(source);
        }
      }
    });
  },

  onSuccess() {
    this.stopTimer();
    if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();

    setTimeout(() => {
      const modal = document.getElementById("tactical-board-modal");
      if (modal) modal.style.display = "none";

      const skillTooltip = document.getElementById("battle-skill-tooltip");
      if (skillTooltip) skillTooltip.style.display = "flex";

      NetDuel.resolveTacticalStrike(true);
    }, 450);
  },

  onError(originalSquare) {
    this.stopTimer();
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();

    setTimeout(() => {
      if (this.board && this.currentPuzzle) this.board.position(this.currentPuzzle.fen);
    }, 300);

    setTimeout(() => {
      const modal = document.getElementById("tactical-board-modal");
      if (modal) modal.style.display = "none";

      const skillTooltip = document.getElementById("battle-skill-tooltip");
      if (skillTooltip) skillTooltip.style.display = "flex";

      NetDuel.resolveTacticalStrike(false);
    }, 550);
  }
};


/* ================= 2. КОНТРОЛЛЕР СЕТЕВОЙ И ИИ ДУЭЛИ ================= */
window.NetDuel = {
  ws: null,
  isNet: false,
  round: 1,
  maxHp: 50,
  myHp: 50,
  enemyHp: 50,
  myEnergy: 1,
  enemyEnergy: 1,
  myShield: false,
  enemyShield: false,
  myHero: null,
  enemyHero: null,
  mySide: "white",
  isWaitingOpponent: false,

  vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  },

  screenShake(heavy = false) {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;
    const cls = heavy ? "screen-shake-heavy" : "screen-shake-light";
    overlay.classList.remove("screen-shake-light", "screen-shake-heavy");
    void overlay.offsetWidth;
    overlay.classList.add(cls);
    setTimeout(() => overlay.classList.remove(cls), 450);
  },

  spawnDamageNumber(anchorId, amount, isCrit = false) {
    const anchor = document.getElementById(anchorId);
    const overlay = document.getElementById("net-battle-overlay");
    if (!anchor || !overlay || (typeof amount === "number" && amount <= 0)) return;

    const rect = anchor.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    const posX = rect.left + rect.width / 2 - overlayRect.left;
    const posY = rect.top + rect.height / 2 - overlayRect.top;

    const el = document.createElement("div");
    el.className = `floating-dmg-num ${isCrit ? "crit" : ""}`;
    if (typeof amount === "string" && amount.startsWith("+")) {
      el.textContent = amount;
      el.style.color = "#00ffcc";
    } else {
      el.textContent = isCrit ? `КРИТ -${amount}` : `-${amount}`;
    }

    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    overlay.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 1800);
  },

  showSuperCutIn(hero, skillName) {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;

    const cutin = document.createElement("div");
    cutin.className = "super-cutin-overlay";
    cutin.innerHTML = `
      <div class="super-cutin-banner">
        <img class="cutin-avatar" src="${hero.img}" alt="${hero.name}">
        <div class="cutin-text-group">
          <span class="cutin-hero-name">${hero.name}</span>
          <span class="cutin-skill-name">«${skillName || "КОРОННЫЙ ХОД"}»</span>
        </div>
      </div>
    `;

    overlay.appendChild(cutin);
    this.screenShake(true);
    this.vibrate([60, 40, 90]);
    setTimeout(() => cutin.remove(), 2400);
  },

  /**
   * Корректно определяет текущего чемпиона игрока из heroes-data.js
   * Поддерживает как строковые ID ("steinitz", "carlsen"), так и числовые индексы (0..18)
   */
  getHero() {
    let h = window.currentHeroData;

    if (!h && typeof currentHeroId !== "undefined" && currentHeroId !== null && typeof HEROES !== "undefined") {
      h = { ...HEROES[currentHeroId], id: currentHeroId };
    }

    if (!h) {
      if (typeof HEROES !== "undefined" && HEROES[0]) {
        h = { ...HEROES[0], id: 0 };
      } else {
        alert("Сначала наведите камеру на карту чемпиона!");
        return null;
      }
    }

    // Находим числовой индекс героя в HERO_STATS_DATA
    let numericId = 0;
    if (typeof HERO_STATS_DATA !== "undefined") {
      const foundKey = Object.keys(HERO_STATS_DATA).find(k => {
        if (k == h.id) return true;
        if (typeof HEROES !== "undefined" && HEROES[k] && HEROES[k].id === h.id) return true;
        return false;
      });
      numericId = foundKey !== undefined ? Number(foundKey) : (typeof h.id === "number" ? h.id : 0);
    }

    const heroCardData = (typeof HERO_STATS_DATA !== "undefined" && HERO_STATS_DATA[numericId]) 
      ? HERO_STATS_DATA[numericId] 
      : { 
          atk: h.atk || 7, 
          def: h.def || 7, 
          rank: h.rankKey || "legend", 
          skillName: h.skillName || "Коронный ход", 
          skillId: h.skillId || "DEFAULT",
          tip: "Накопите 2 единицы энергии для сокрушительного удара" 
        };
      
    const rankKey = heroCardData.rank || h.rankKey || "legend";
    const rankInfo = (typeof HERO_RANKS !== "undefined" && HERO_RANKS[rankKey]) 
      ? HERO_RANKS[rankKey] 
      : { name: "ЛЕГЕНДА", color: "#e2b868" };

    return {
      id: h.id !== undefined ? h.id : numericId,
      numericId: numericId,
      name: h.name || "Гроссмейстер",
      img: h.avatar || "./assets/avatars/steinitz.png",
      atk: heroCardData.atk,
      def: heroCardData.def,
      rank: rankInfo.name,
      rankKey: rankKey,
      rankColor: rankInfo.color,
      skillName: heroCardData.skillName,
      skillId: heroCardData.skillId,
      tip: heroCardData.tip || "Накопите 2 единицы энергии для сокрушительного удара"
    };
  },

  openLobby() {
    this.myHero = this.getHero();
    if (!this.myHero) return;

    const actionsStack = document.querySelector(".duel-actions-stack");
    if (actionsStack && !document.getElementById("btn-ai-duel")) {
      const aiBtn = document.createElement("button");
      aiBtn.id = "btn-ai-duel";
      aiBtn.className = "duel-secondary-btn";
      aiBtn.style.borderColor = "var(--accent-gold, #f1c40f)";
      aiBtn.style.color = "var(--accent-gold, #f1c40f)";
      aiBtn.textContent = "Дуэль со случайным соперником (Одиночный)";
      aiBtn.onclick = () => NetDuel.startOfflineAiMatch();
      actionsStack.appendChild(aiBtn);
    }

    document.getElementById("duel-lobby-modal")?.classList.add("active");
    this.setStep("lobby-step-select");
  },

  hideLobbyModal() {
    document.getElementById("duel-lobby-modal")?.classList.remove("active");
  },

  closeLobby() {
    InteractiveBoardEngine.stopTimer();
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.hideLobbyModal();
  },

  setStep(id) {
    ["lobby-step-select", "lobby-step-host", "lobby-step-join"].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? "block" : "none";
    });
  },

  createRoom() {
    this.setStep("lobby-step-host");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const codeEl = document.getElementById("host-room-id");
    if (codeEl) codeEl.textContent = code;
    this.connect(code);
  },

  showJoinInput() {
    this.setStep("lobby-step-join");
    const input = document.getElementById("join-room-input");
    if (input) { input.value = ""; input.focus(); }
  },

  joinRoomById() {
    const code = document.getElementById("join-room-input")?.value.trim();
    if (code?.length === 4) this.connect(code);
    else alert("Введите 4 цифры стола!");
  },

  connect(code) {
    try {
      this.ws = new WebSocket(`${AMVERA_WS}/ws/duel/${code}`);

      this.ws.onopen = () => {
        this.isNet = true;
        this.ws.send(JSON.stringify({ type: "READY", hero: this.myHero }));
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "MATCH_START") {
            this.enemyHero = msg.enemy;
            this.mySide = msg.side || "white";
            this.hideLobbyModal();
            this.startBattle();
          } else if (msg.type === "ROUND_RESULT") {
            this.applyRoundResult(msg);
          } else if (msg.type === "OPPONENT_DISCONNECTED") {
            this.setLog("СОПЕРНИК ВЫШЕЛ ИЗ БОЯ");
            setTimeout(() => this.endBattle('win'), 1500);
          } else if (msg.type === "ERROR") {
            alert(msg.message);
            this.closeLobby();
          }
        } catch (err) {
          console.error("Ошибка парсинга WS:", err);
        }
      };

      this.ws.onerror = () => {
        if (!this.isNet) this.askOffline();
      };
      
      this.ws.onclose = () => {
        if (!this.isNet) this.askOffline();
      };
    } catch {
      this.askOffline();
    }
  },

  askOffline() {
    if (confirm("Сетевой сервер недоступен. Сыграть тренировку с ботом?")) {
      this.startOfflineAiMatch();
    } else {
      this.closeLobby();
    }
  },

  /**
   * Запуск дуэли с ботом: выбирает случайного соперника из всех 19 карт heroes-data.js (0..18)
   */
  startOfflineAiMatch() {
    this.isNet = false;
    this.mySide = "white";

    // 1. Получаем список всех доступных числовых ID героев (0..18)
    const availableHeroIds = (typeof HERO_STATS_DATA !== "undefined")
      ? Object.keys(HERO_STATS_DATA).map(Number).filter(n => !isNaN(n))
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

    // 2. Исключаем текущего героя игрока (как по числу, так и по строковому id)
    const candidateIds = availableHeroIds.filter(id => {
      const heroObj = (typeof HEROES !== "undefined") ? HEROES[id] : null;
      return id !== this.myHero.numericId && id !== this.myHero.id && heroObj?.id !== this.myHero.id;
    });

    // 3. Выбираем случайного соперника
    const randomEnemyId = candidateIds.length > 0
      ? candidateIds[Math.floor(Math.random() * candidateIds.length)]
      : (this.myHero.numericId === 0 ? 7 : 0);

    // 4. Достаем данные выбранного героя из HEROES и HERO_STATS_DATA
    const baseHero = (typeof HEROES !== "undefined" && HEROES[randomEnemyId]) 
      ? HEROES[randomEnemyId] 
      : null;

    const statsData = (typeof HERO_STATS_DATA !== "undefined" && HERO_STATS_DATA[randomEnemyId])
      ? HERO_STATS_DATA[randomEnemyId]
      : { atk: 7, def: 7, rank: "legend", skillName: "Коронный ход", skillId: "DEFAULT", tip: "" };

    const rankInfo = (typeof HERO_RANKS !== "undefined" && HERO_RANKS[statsData.rank])
      ? HERO_RANKS[statsData.rank]
      : { name: "ЛЕГЕНДА", color: "#e2b868" };

    // 5. Инициализируем бота
    this.enemyHero = {
      id: randomEnemyId,
      numericId: randomEnemyId,
      name: baseHero?.name || `Гроссмейстер #${randomEnemyId}`,
      atk: statsData.atk,
      def: statsData.def,
      rank: rankInfo.name,
      rankKey: statsData.rank,
      rankColor: rankInfo.color,
      skillName: statsData.skillName,
      skillId: statsData.skillId,
      tip: statsData.tip,
      img: baseHero?.avatar || `./assets/avatars/steinitz.png`
    };

    this.hideLobbyModal();
    this.startBattle();
  },

  startBattle() {
    if (typeof stopAllTargetVideosImmediate === "function") {
      stopAllTargetVideosImmediate();
    }

    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.display = "flex";
    document.getElementById("duel-victory-modal")?.classList.remove("active");

    this.round = 1;
    this.myHp = this.maxHp;
    this.enemyHp = this.maxHp;
    this.myEnergy = 1;
    this.enemyEnergy = 1;
    this.myShield = false;
    this.enemyShield = false;
    this.isWaitingOpponent = false;

    if (typeof sfx !== "undefined" && sfx.playBattleStart) {
      sfx.playBattleStart();
    }
    this.vibrate(60);

    this.lockActions(false);
    this.updateHUD();
    this.setLog("БИТВА НАЧАЛАСЬ! ВЫБЕРИТЕ ХОД");
  },

  lockActions(state) {
    this.isWaitingOpponent = state;
    const btns = document.querySelectorAll(".tactical-card-btn");
    btns.forEach(b => {
      b.style.pointerEvents = state ? "none" : "auto";
      b.style.opacity = state ? "0.45" : "1";
    });
  },

  updateHUD() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    // 1. Игрок
    set("my-hero-name", this.myHero.name);
    const myImg = document.getElementById("my-avatar-img");
    if (myImg) myImg.src = this.myHero.img;

    const currentMyHp = Math.max(0, Math.min(this.maxHp, this.myHp));
    set("my-hp-text", `${currentMyHp} / ${this.maxHp}`);
    const myHpPercent = Math.round((currentMyHp / this.maxHp) * 100);
    const myBar = document.getElementById("my-hp-bar");
    if (myBar) myBar.style.width = `${myHpPercent}%`;
    const myGhost = document.getElementById("my-hp-ghost");
    if (myGhost) myGhost.style.width = `${myHpPercent}%`;

    set("my-atk-val", this.myHero.atk);
    set("my-def-val", this.myHero.def);
    set("my-energy-val", `${this.myEnergy}/2`);
    const pShield = document.getElementById("player-shield-fx");
    if (pShield) pShield.style.display = this.myShield ? "flex" : "none";

    const pRankBadge = document.querySelector(".player-panel .actor-side-badge");
    if (pRankBadge && this.myHero.rank) {
      pRankBadge.textContent = this.myHero.rank;
      pRankBadge.className = `actor-side-badge rank-${(this.myHero.rankKey || 'legend').toLowerCase()}`;
    }

    // 2. Оппонент
    set("enemy-hero-name", this.enemyHero.name);
    const enemyImg = document.getElementById("enemy-avatar-img");
    if (enemyImg) enemyImg.src = this.enemyHero.img;

    const currentEnemyHp = Math.max(0, Math.min(this.maxHp, this.enemyHp));
    set("enemy-hp-text", `${currentEnemyHp} / ${this.maxHp}`);
    const enemyHpPercent = Math.round((currentEnemyHp / this.maxHp) * 100);
    const enemyBar = document.getElementById("enemy-hp-bar");
    if (enemyBar) enemyBar.style.width = `${enemyHpPercent}%`;
    const enemyGhost = document.getElementById("enemy-hp-ghost");
    if (enemyGhost) enemyGhost.style.width = `${enemyHpPercent}%`;

    set("enemy-atk-val", this.enemyHero.atk);
    set("enemy-def-val", this.enemyHero.def);
    set("enemy-energy-tracker", `${this.enemyEnergy}/2`);
    const eShield = document.getElementById("enemy-shield-fx");
    if (eShield) eShield.style.display = this.enemyShield ? "flex" : "none";

    const eRankBadge = document.querySelector(".enemy-panel .actor-side-badge");
    if (eRankBadge && this.enemyHero.rank) {
      eRankBadge.textContent = this.enemyHero.rank;
      eRankBadge.className = `actor-side-badge rank-${(this.enemyHero.rankKey || 'legend').toLowerCase()}`;
    }

    // 3. Диоды энергии
    const spcBtn = document.getElementById("btn-action-spc");
    const led1 = document.getElementById("spc-led-1");
    const led2 = document.getElementById("spc-led-2");
    if (led1) led1.classList.toggle("on", this.myEnergy >= 1);
    if (led2) led2.classList.toggle("on", this.myEnergy >= 2);
    if (spcBtn) spcBtn.classList.toggle("ready", this.myEnergy >= 2);

    // 4. Оценка позиции и номер раунда
    set("round-title-badge", `РАУНД ${this.round}`);
    const evalScore = Math.min(100, Math.max(0, 50 + (this.myHp - this.enemyHp)));
    const evalFill = document.getElementById("duel-eval-fill");
    if (evalFill) evalFill.style.height = `${evalScore}%`;
    const scoreVal = ((evalScore - 50) / 10).toFixed(1);
    set("duel-eval-score", Number(scoreVal) > 0 ? `+${scoreVal}` : scoreVal);

    // 5. Подсказка уникального навыка из HERO_STATS_DATA
    const skillTipEl = document.getElementById("tooltip-skill-desc");
    const skillNameEl = document.getElementById("tooltip-skill-name");

    if (this.myHero) {
      if (skillNameEl) {
        skillNameEl.textContent = (this.myHero.skillName || "НАВЫК").toUpperCase();
      }
      if (skillTipEl) {
        skillTipEl.textContent = this.myHero.tip 
          || (typeof HERO_STATS_DATA !== "undefined" && HERO_STATS_DATA[this.myHero.numericId]?.tip)
          || "Накопите 2 единицы энергии для сокрушительного удара";
      }
    }
  },

  setLog(text) {
    const el = document.getElementById("battle-log");
    if (el) el.textContent = text;
  },

  chooseAction(type) {
    if (this.isWaitingOpponent) return;

    if (type === "attack") {
      this.lockActions(true);
      this.setLog("РЕШИТЕ ТАКТИЧЕСКУЮ ЗАДАЧУ...");
      InteractiveBoardEngine.start();
      return;
    }

    if (type === "defend") {
      this.lockActions(true);
      if (typeof sfx !== "undefined" && sfx.playShield) sfx.playShield();
      this.vibrate(35);

      if (this.isNet) {
        this.myShield = true;
        this.updateHUD();
        this.ws.send(JSON.stringify({ type: "MOVE", action: "defend" }));
        this.setLog("ЗАЩИТА! ЖДЕМ ОППОНЕНТА...");
      } else {
        this.myShield = true;
        this.myEnergy = Math.min(2, this.myEnergy + 1);
        this.fx("cyan");
        this.updateHUD();
        this.runAiTurn("defend", false);
      }
      return;
    }

    if (type === "skill") {
      if (this.myEnergy < 2) return this.setLog("НЕДОСТАТОЧНО ЭНЕРГИИ!");
      this.lockActions(true);

      this.showSuperCutIn(this.myHero, this.myHero.skillName);

      if (typeof sfx !== "undefined" && sfx.playUltimate) sfx.playUltimate();

      if (this.isNet) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setLog("КОРОННЫЙ ХОД! ЖДЕМ ХОД...");
      } else {
        this.runAiTurn("skill", false);
      }
    }
  },

  resolveTacticalStrike(isCrit) {
    this.lockActions(true);

    if (typeof sfx !== "undefined") {
      if (isCrit && sfx.playCritHit) sfx.playCritHit();
      else if (sfx.playAttackHit) sfx.playAttackHit();
    }

    if (isCrit) {
      this.screenShake(true);
      this.vibrate([50, 40, 80]);
    } else {
      this.vibrate(35);
    }

    if (this.isNet) {
      this.ws.send(JSON.stringify({ type: "MOVE", action: "attack", crit: isCrit }));
      this.setLog(isCrit ? "ТОЧНЫЙ ХОД! • КРИТИЧЕСКИЙ УРОН" : "АТАКА • ОЖИДАНИЕ ХОДА");
    } else {
      this.runAiTurn("attack", isCrit);
    }
  },

  applyRoundResult(res) {
    const eCard = document.getElementById("enemy-card-anchor");

    this.enemyShield = (res.enemy_action === "defend");
    if (res.enemy_action === "attack") eCard?.classList.add("anim-lunge-down");
    if (res.enemy_action === "skill") {
      eCard?.classList.add("anim-skill-blast");
      if (this.enemyHero) {
        this.showSuperCutIn(this.enemyHero, this.enemyHero.skillName);
      }
    }

    this.updateHUD();

    setTimeout(() => {
      eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");

      const isCritAtk = res.dmg_dealt > (this.myHero.atk * 1.2);
      if (res.dmg_dealt > 0) {
        this.spawnDamageNumber("enemy-card-anchor", res.dmg_dealt, isCritAtk);
      }
      if (res.dmg_taken > 0) {
        this.spawnDamageNumber("player-card-anchor", res.dmg_taken, false);
      }

      if (typeof sfx !== "undefined") {
        if (res.dmg_taken > 0) {
          sfx.playDamageTaken();
          this.screenShake(false);
          this.vibrate(50);
        } else if (res.dmg_dealt > 0) {
          sfx.playDamageDealt();
          if (isCritAtk) this.screenShake(true);
        }
      }

      let incomingMyHp = res.my_hp;
      let incomingEnemyHp = res.enemy_hp;
      if (incomingMyHp > 50 || incomingEnemyHp > 50) {
        incomingMyHp = Math.round(incomingMyHp / 2);
        incomingEnemyHp = Math.round(incomingEnemyHp / 2);
      }

      this.myHp = Math.max(0, Math.min(50, incomingMyHp));
      this.enemyHp = Math.max(0, Math.min(50, incomingEnemyHp));
      this.myEnergy = res.my_energy;
      this.enemyEnergy = res.enemy_energy;
      this.round = res.round;
      this.myShield = false;
      this.enemyShield = false;

      this.updateHUD();
      this.setLog(`УРОН: -${res.dmg_dealt} | ПОЛУЧЕНО: -${res.dmg_taken}`);
      this.fx(res.dmg_dealt >= res.dmg_taken ? "gold" : "red");

      setTimeout(() => {
        if (this.myHp <= 0 || this.enemyHp <= 0) {
          let outcome = 'lose';
          if (this.myHp <= 0 && this.enemyHp <= 0) outcome = 'draw';
          else if (this.myHp > 0 && this.enemyHp <= 0) outcome = 'win';

          this.endBattle(outcome);
        } else {
          this.lockActions(false);
          this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
        }
      }, 900);
    }, 600);
  },

  /**
   * Логика раунда в дуэли против ИИ бота
   * Включает все 19 уникальных навыков чемпионов из heroes-data.js
   */
  runAiTurn(playerAct, isCrit) {
    const pCard = document.getElementById("player-card-anchor");
    const eCard = document.getElementById("enemy-card-anchor");

    const CRIT_BONUS = 5;
    let oppAct = this.enemyEnergy >= 2 ? "skill" : (Math.random() > 0.45 ? "attack" : "defend");

    let pDmg = 0;
    let eDmg = 0;
    let ignoreEnemyDef = false;
    let ignorePlayerDef = false;
    let reflectDamageToEnemy = false;

    // 1. ДЕЙСТВИЕ ИГРОКА (УЛЬТИМЕЙТЫ 19 ЧЕМПИОНОВ)
    if (playerAct === "skill") {
      pCard?.classList.add("anim-skill-blast");
      this.myEnergy = 0;
      this.fx("gold");
      const skill = this.myHero.skillId;

      switch (skill) {
        // 0. Стейниц: 12 DMG сквозь щит и снижение атаки врага на 3
        case "STEINITZ_EQUILIBRIUM":
          ignoreEnemyDef = true;
          pDmg = 12;
          this.enemyHero.atk = Math.max(2, this.enemyHero.atk - 3);
          this.setLog("ТЕОРИЯ РАВНОВЕСИЯ: 12 DMG СКВОЗЬ ЩИТ, АТАКА ВРАГА -3!");
          break;

        // 1. Ласкер: Психологический нокаут на 17 DMG
        case "LASKER_GAMBIT":
          pDmg = 17;
          this.setLog("ПСИХОЛОГИЧЕСКИЙ ГАМБИТ: НОКАУТ НА 17 DMG!");
          break;

        // 2. Капабланка: Чистый урон 16 DMG, полностью игнорирующий блок щитом
        case "CAPABLANCA_INTUITION":
          ignoreEnemyDef = true;
          pDmg = 16;
          this.setLog("ГЕНИАЛЬНАЯ ИНТУИЦИЯ: 16 DMG ЧИСТОГО УРОНА СКВОЗЬ БЛОК!");
          break;

        // 3. Алехин: Пробивающий удар: 24 DMG сквозь щит и броню соперника
        case "ALEKHINE_BLINDING_STRIKE":
          ignoreEnemyDef = true;
          pDmg = 24;
          this.screenShake(true);
          this.vibrate([60, 40, 100]);
          this.setLog("ОСЛЕПЛЯЮЩАЯ АТАКА АЛЕХИНА: 24 DMG СКВОЗЬ ЛЮБУЮ БРОНЮ!");
          break;

        // 4. Эйве: Удар 14 DMG и усиление собственной защиты на 5
        case "EUWE_LOGIC":
          pDmg = 14;
          this.myHero.def = (this.myHero.def || 8) + 5;
          this.setLog("МАТЕМАТИЧЕСКИЙ РАСЧЕТ: УДАР 14 DMG И ЗАЩИТА +5!");
          break;

        // 5. Ботвинник: Удар на 12 DMG и автоматический железный блок
        case "BOTVINNIK_ARCHITECT":
          pDmg = 12;
          this.myShield = true;
          this.setLog("АРХИТЕКТОР МЫСЛИ: 12 DMG И АВТОМАТИЧЕСКИЙ ЖЕЛЕЗНЫЙ БЛОК!");
          break;

        // 6. Смыслов: Удар 12 DMG. Если отстаете по здоровью — исцеление +10 HP
        case "SMYSLOV_SYMPHONY":
          pDmg = 12;
          if (this.myHp < this.enemyHp) {
            this.myHp = Math.min(50, this.myHp + 10);
            this.spawnDamageNumber("player-card-anchor", "+10", true);
            this.setLog("МАГИСТР ГАРМОНИИ: 12 DMG И ИСЦЕЛЕНИЕ +10 HP!");
          } else {
            this.setLog("МАГИСТР ГАРМОНИИ: 12 DMG ГАРМОНИЧНОГО НАСТУПЛЕНИЯ!");
          }
          break;

        // 7. Таль: Жертвует 4 HP ради сокрушительного шторма на 26 DMG
        case "TAL_STORM":
          this.myHp = Math.max(1, this.myHp - 4);
          pDmg = 26;
          this.spawnDamageNumber("player-card-anchor", 4, false);
          this.screenShake(true);
          this.setLog("ЯРОСТЬ ШТОРМА ТАЛЯ: ЖЕРТВА 4 HP И УДАР НА 26 DMG!");
          break;

        // 8. Петросян: Удар 6 DMG, непробиваемый щит и лечение +14 HP
        case "PETROSYAN_FORTRESS":
          this.myShield = true;
          this.myHp = Math.min(50, this.myHp + 14);
          pDmg = 6;
          this.spawnDamageNumber("player-card-anchor", "+14", true);
          this.setLog("ЖЕЛЕЗНАЯ ПРОФИЛАКТИКА: НЕПРОБИВАЕМЫЙ ЩИТ И +14 HP!");
          break;

        // 9. Спасский: Удар 18 DMG и снятие щитов с оппонента
        case "SPASSKY_GAMBIT":
          ignoreEnemyDef = true;
          this.enemyShield = false;
          pDmg = 18;
          this.setLog("КОРОЛЕВСКИЙ ГАМБИТ: 18 DMG И СНЯТИЕ ВСЕХ ЩИТОВ ВРАГА!");
          break;

        // 10. Фишер: Партия века: 21 DMG сквозь любые щиты
        case "FISCHER_TORNADO":
          ignoreEnemyDef = true;
          pDmg = 21;
          this.screenShake(true);
          this.setLog("МЕНТАЛЬНЫЙ ТОРНАДО ФИШЕРА: 21 DMG СКВОЗЬ ВСЕ ЩИТЫ!");
          break;

        // 11. Карпов: Удар 14 DMG и блокировка энергии оппонента на 1 ход
        case "KARPOV_ANACONDA":
          pDmg = 14;
          this.enemyEnergy = 0;
          this.setLog("ХВАТКА АНАКОНДЫ КАРПОВА: 14 DMG И ЭНЕРГИЯ ВРАГА СБРОШЕНА!");
          break;

        // 12. Ананд: «Молния Мадраса» — Двойной блиц-разряд (11+11 = 22 DMG) сквозь блок + возврат 1⚡ энергии
        case "ANAND_LIGHTNING":
          ignoreEnemyDef = true; // Пробивает блок за счет сверхсветовой скорости
          pDmg = 22;
          this.myEnergy = 1; // Скорость мышления восстанавливает темп
          this.screenShake(true);
          this.vibrate([40, 30, 40, 30, 80]);
          // Двойной спавн циферок урона как два быстрых удара молнии
          this.spawnDamageNumber("enemy-card-anchor", 11, true);
          setTimeout(() => this.spawnDamageNumber("enemy-card-anchor", 11, true), 220);
          this.setLog("МОЛНИЯ МАДРАСА: ДВОЙНОЙ РАЗРЯД 11+11 DMG СКВОЗЬ БЛОК (+1⚡ ТЕМПА)!");
          break;

        // 13. Дин Лижэнь: «Воля дракона (Ход 46...Rg6!)» — Ва-банк: урон растет от потерянного здоровья Дина + щит
        case "DING_DRAGON":
          const dingLostHp = Math.max(0, 50 - this.myHp);
          const dragonBonus = Math.min(14, Math.round(dingLostHp * 0.45));
          pDmg = 14 + dragonBonus;
          this.myShield = true; // Стойкая самосвязка и щит дракона
          this.screenShake(true);
          this.vibrate([70, 50, 110]);
          this.setLog(`ВОЛЯ ДРАКОНА (46...Rg6!): ВА-БАНК 14+${dragonBonus} DMG И БРОНЯ ДРАКОНА!`);
          break;

        // 14. Гукеш: «Сакральный разум» — Стальные нервы Торонто: 16 DMG, сокрушение щита, похищение 1⚡ и лечение +8 HP
        case "GUKESH_MIND":
          ignoreEnemyDef = true;
          this.enemyShield = false; // Сокрушает защиту врага
          pDmg = 16;
          // Похищение энергии у соперника
          if (this.enemyEnergy > 0) {
            this.enemyEnergy = Math.max(0, this.enemyEnergy - 1);
            this.myEnergy = Math.min(2, this.myEnergy + 1);
          }
          // Медитативное восстановление хладнокровия
          this.myHp = Math.min(50, this.myHp + 8);
          this.spawnDamageNumber("player-card-anchor", "+8", true);
          this.screenShake(false);
          this.vibrate([50, 40, 60]);
          this.setLog("САКРАЛЬНЫЙ РАЗУМ: 16 DMG, СЛОМ ЩИТА, КРАЖА 1⚡ И +8 HP!");
          break;

        // 15. Stockfish: Квантовый расчет на 27 DMG и исцеление +8 HP
        case "STOCKFISH_ENGINE":
          pDmg = 27;
          this.myHp = Math.min(50, this.myHp + 8);
          this.spawnDamageNumber("player-card-anchor", "+8", true);
          this.screenShake(true);
          this.setLog("СУПЕРКОМПЬЮТЕР (+M12): КВАНТОВЫЙ РАСЧЕТ 27 DMG И +8 HP!");
          break;

        // 16. Рэй Энигма: Удар 12 DMG: отражает атаку врага обратно или крадет энергию
        case "ENIGMA_CHAMELEON":
          if (oppAct === "attack") {
            reflectDamageToEnemy = true;
            this.setLog("ХАМЕЛЕОН ЭНИГМЫ: АТАКА ВРАГА ПОЛНОСТЬЮ ОТРАЖЕНА!");
          } else {
            this.enemyEnergy = 0;
            this.myEnergy = 1;
            this.setLog("ХАМЕЛЕОН ЭНИГМЫ: ЭНЕРГИЯ ВРАГА ПОХИЩЕНА (+1⚡)!");
          }
          pDmg = 12;
          break;

        // 17. Каспаров: Сокрушительный штурм 24 DMG и мгновенный возврат 1⚡ энергии
        case "KASPAROV_ADVENTURE":
          pDmg = 24;
          this.myEnergy = 1;
          this.screenShake(true);
          this.vibrate([60, 40, 100]);
          this.setLog("ДУХ ПРИКЛЮЧЕНИЙ КАСПАРОВА: 24 DMG И ВОЗВРАТ 1⚡ ЭНЕРГИИ!");
          break;

        // 18. Карлсен: Добивающий удар: 18 DMG + 35% от потерянного HP врага
        case "CARLSEN_ENDGAME":
          const missingEnemyHp = Math.max(0, 50 - this.enemyHp);
          const bonusEndgame = Math.round(missingEnemyHp * 0.35);
          pDmg = 18 + bonusEndgame;
          this.screenShake(true);
          this.setLog(`КВАНТОВЫЙ ЭНДШПИЛЬ КАРЛСЕНА: 18 + ${bonusEndgame} БОНУСА = ${pDmg} DMG!`);
          break;

        default:
          pDmg = this.myHero.atk * 2;
          this.setLog(`КОРОННЫЙ ХОД: СОКРУШИТЕЛЬНЫЙ УДАР НА ${pDmg} DMG!`);
          break;
      }
    } else if (playerAct === "attack") {
      pCard?.classList.add("anim-lunge-up");
      pDmg = this.myHero.atk + (isCrit ? CRIT_BONUS : 0);
    } else if (playerAct === "defend") {
      this.myShield = true;
    }

    // 2. ДЕЙСТВИЕ СОПЕРНИКА (ИИ БОТА)
    if (oppAct === "attack") {
      eCard?.classList.add("anim-lunge-down");
      eDmg = this.enemyHero.atk;
    } else if (oppAct === "skill") {
      eCard?.classList.add("anim-skill-blast");
      this.enemyEnergy = 0;
      this.showSuperCutIn(this.enemyHero, this.enemyHero.skillName);

      const enemySkill = this.enemyHero.skillId;
      switch (enemySkill) {
        // 0. Стейниц
        case "STEINITZ_EQUILIBRIUM":
          ignorePlayerDef = true;
          eDmg = 12;
          this.myHero.atk = Math.max(2, this.myHero.atk - 3);
          this.setLog(`БОТ (${this.enemyHero.name}): ТЕОРИЯ РАВНОВЕСИЯ (-3 К ВАШЕЙ АТАКЕ)!`);
          break;

        // 1. Ласкер
        case "LASKER_GAMBIT":
          eDmg = 17;
          this.setLog(`БОТ (${this.enemyHero.name}): ПСИХОЛОГИЧЕСКИЙ ГАМБИТ НА 17 DMG!`);
          break;

        // 2. Капабланка
        case "CAPABLANCA_INTUITION":
          ignorePlayerDef = true;
          eDmg = 16;
          this.setLog(`БОТ (${this.enemyHero.name}): ИНТУИЦИЯ (16 DMG СКВОЗЬ ЩИТ)!`);
          break;

        // 3. Алехин
        case "ALEKHINE_BLINDING_STRIKE":
          ignorePlayerDef = true;
          eDmg = 24;
          this.setLog(`БОТ (${this.enemyHero.name}): ОСЛЕПЛЯЮЩАЯ АТАКА (24 DMG СКВОЗЬ БРОНЮ)!`);
          break;

        // 4. Эйве
        case "EUWE_LOGIC":
          eDmg = 14;
          this.enemyHero.def = (this.enemyHero.def || 8) + 5;
          this.setLog(`БОТ (${this.enemyHero.name}): МАТЕМАТИЧЕСКИЙ РАСЧЕТ (+5 К ЗАЩИТЕ)!`);
          break;

        // 5. Ботвинник
        case "BOTVINNIK_ARCHITECT":
          eDmg = 12;
          this.enemyShield = true;
          this.setLog(`БОТ (${this.enemyHero.name}): АРХИТЕКТОР МЫСЛИ И ЖЕЛЕЗНЫЙ БЛОК!`);
          break;

        // 6. Смыслов
        case "SMYSLOV_SYMPHONY":
          eDmg = 12;
          if (this.enemyHp < this.myHp) {
            this.enemyHp = Math.min(50, this.enemyHp + 10);
            this.spawnDamageNumber("enemy-card-anchor", "+10", true);
            this.setLog(`БОТ (${this.enemyHero.name}): МАГИСТР ГАРМОНИИ (+10 HP)!`);
          }
          break;

        // 7. Таль
        case "TAL_STORM":
          this.enemyHp = Math.max(1, this.enemyHp - 4);
          eDmg = 26;
          this.spawnDamageNumber("enemy-card-anchor", 4, false);
          this.setLog(`БОТ (${this.enemyHero.name}): ЯРОСТЬ ШТОРМА ТАЛЯ (-4 HP / 26 DMG)!`);
          break;

        // 8. Петросян
        case "PETROSYAN_FORTRESS":
          this.enemyShield = true;
          this.enemyHp = Math.min(50, this.enemyHp + 14);
          eDmg = 6;
          this.spawnDamageNumber("enemy-card-anchor", "+14", true);
          this.setLog(`БОТ (${this.enemyHero.name}): ЖЕЛЕЗНАЯ КРЕПОСТЬ (+14 HP И ЩИТ)!`);
          break;

        // 9. Спасский
        case "SPASSKY_GAMBIT":
          ignorePlayerDef = true;
          this.myShield = false;
          eDmg = 18;
          this.setLog(`БОТ (${this.enemyHero.name}): КОРОЛЕВСКИЙ ГАМБИТ (ЩИТ СНЯТ)!`);
          break;

        // 10. Фишер
        case "FISCHER_TORNADO":
          ignorePlayerDef = true;
          eDmg = 21;
          this.setLog(`БОТ (${this.enemyHero.name}): МЕНТАЛЬНЫЙ ТОРНАДО (21 DMG СКВОЗЬ ЩИТ)!`);
          break;

        // 11. Карпов
        case "KARPOV_ANACONDA":
          eDmg = 14;
          this.myEnergy = 0;
          this.setLog(`БОТ (${this.enemyHero.name}): ХВАТКА АНАКОНДЫ (ВАША ЭНЕРГИЯ СБРОШЕНА)!`);
          break;

        // 12. Ананд (Бот)
        case "ANAND_LIGHTNING":
          ignorePlayerDef = true;
          eDmg = 22;
          this.enemyEnergy = 1;
          this.spawnDamageNumber("player-card-anchor", 11, true);
          setTimeout(() => this.spawnDamageNumber("player-card-anchor", 11, true), 220);
          this.setLog(`БОТ (${this.enemyHero.name}): МОЛНИЯ МАДРАСА (ДВОЙНОЙ РАЗРЯД 11+11 DMG И +1⚡)!`);
          break;

        // 13. Дин Лижэнь (Бот)
        case "DING_DRAGON":
          const enemyLostHp = Math.max(0, 50 - this.enemyHp);
          const enemyDragonBonus = Math.min(14, Math.round(enemyLostHp * 0.45));
          eDmg = 14 + enemyDragonBonus;
          this.enemyShield = true;
          this.setLog(`БОТ (${this.enemyHero.name}): ВОЛЯ ДРАКОНА ВА-БАНК (${eDmg} DMG И ЩИТ)!`);
          break;

        // 14. Гукеш (Бот)
        case "GUKESH_MIND":
          ignorePlayerDef = true;
          this.myShield = false;
          eDmg = 16;
          if (this.myEnergy > 0) {
            this.myEnergy = Math.max(0, this.myEnergy - 1);
            this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
          }
          this.enemyHp = Math.min(50, this.enemyHp + 8);
          this.spawnDamageNumber("enemy-card-anchor", "+8", true);
          this.setLog(`БОТ (${this.enemyHero.name}): САКРАЛЬНЫЙ РАЗУМ (16 DMG, СЛОМ ВАШЕГО ЩИТА, КРАЖА 1⚡ И +8 HP)!`);
          break;

        // 15. Stockfish
        case "STOCKFISH_ENGINE":
          eDmg = 27;
          this.enemyHp = Math.min(50, this.enemyHp + 8);
          this.spawnDamageNumber("enemy-card-anchor", "+8", true);
          this.setLog(`БОТ (${this.enemyHero.name}): СУПЕРКОМПЬЮТЕР 27 DMG (+8 HP)!`);
          break;

        // 16. Рэй Энигма
        case "ENIGMA_CHAMELEON":
          eDmg = 12;
          this.myEnergy = 0;
          this.setLog(`БОТ (${this.enemyHero.name}): ХАМЕЛЕОН ЭНИГМЫ ПОХИТИЛ ВАШУ ЭНЕРГИЮ!`);
          break;

        // 17. Каспаров
        case "KASPAROV_ADVENTURE":
          eDmg = 24;
          this.enemyEnergy = 1;
          this.setLog(`БОТ (${this.enemyHero.name}): ДУХ ПРИКЛЮЧЕНИЙ (24 DMG + 1⚡)!`);
          break;

        // 18. Карлсен
        case "CARLSEN_ENDGAME":
          const missingMyHp = Math.max(0, 50 - this.myHp);
          const botBonus = Math.round(missingMyHp * 0.35);
          eDmg = 18 + botBonus;
          this.setLog(`БОТ (${this.enemyHero.name}): КВАНТОВЫЙ ЭНДШПИЛЬ НА ${eDmg} DMG!`);
          break;

        default:
          eDmg = this.enemyHero.atk * 2;
          break;
      }
    } else {
      this.enemyShield = true;
      this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
    }

    // 3. ОТРАЖЕНИЕ УРОНА (ЭНИГМА)
    if (reflectDamageToEnemy) {
      pDmg += eDmg;
      eDmg = 0;
    }

    // 4. ПРИМЕНЕНИЕ БРОНИ
    if (this.enemyShield && !ignoreEnemyDef && pDmg > 0) {
      pDmg = Math.max(1, pDmg - this.enemyHero.def);
    }

    if (this.myShield && !ignorePlayerDef && eDmg > 0) {
      eDmg = Math.max(1, eDmg - this.myHero.def);
    }

    if (pDmg > 0) this.spawnDamageNumber("enemy-card-anchor", pDmg, isCrit || playerAct === "skill");
    if (eDmg > 0) this.spawnDamageNumber("player-card-anchor", eDmg, false);

    this.enemyHp = Math.max(0, this.enemyHp - pDmg);
    this.myHp = Math.max(0, this.myHp - eDmg);
    this.round++;

    if (typeof sfx !== "undefined") {
      if (eDmg > 0) sfx.playDamageTaken();
      if (pDmg > 0) sfx.playDamageDealt();
    }

    setTimeout(() => {
      eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
      pCard?.classList.remove("anim-lunge-up", "anim-skill-blast");

      this.myShield = false;
      this.enemyShield = false;
      this.updateHUD();

      // ЧЕСТНЫЙ РАСЧЕТ ИСХОДА РАУНДА (БЕЗ ОШИБОК НИЧЬЕЙ)
      if (this.enemyHp <= 0 || this.myHp <= 0) {
        let outcome = 'lose';
        if (this.myHp <= 0 && this.enemyHp <= 0) outcome = 'draw';
        else if (this.myHp > 0 && this.enemyHp <= 0) outcome = 'win';
        this.endBattle(outcome);
      } else {
        this.lockActions(false);
        this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
      }
    }, 700);
  },

  endBattle(outcome) {
    this.lockActions(true);

    const isDraw = (outcome === 'draw' || (this.myHp <= 0 && this.enemyHp <= 0));
    const isWin = (!isDraw && (outcome === 'win' || outcome === true || (this.myHp > 0 && this.enemyHp <= 0)));

    this.fx(isWin ? "gold" : (isDraw ? "cyan" : "red"));

    const victoryModal = document.getElementById("duel-victory-modal");
    const titleEl = document.getElementById("victory-title");
    const subEl = document.getElementById("victory-subtitle");
    const avatarEl = document.getElementById("victory-avatar-img");
    const nameEl = document.getElementById("victory-winner-name");
    const detailsEl = document.getElementById("victory-details-text");
    const crownEl = document.getElementById("victory-crown");

    if (isDraw) {
      if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
      if (crownEl) crownEl.innerText = "♚ ♚";
      if (titleEl) {
        titleEl.innerText = "БОЕВАЯ НИЧЬЯ";
        titleEl.style.color = "#00ffcc";
      }
      if (subEl) subEl.innerText = "НИКТО НЕ УСТУПИЛ";
      if (avatarEl) avatarEl.src = this.myHero.img;
      if (nameEl) nameEl.innerText = `${this.myHero.name} & ${this.enemyHero.name}`;
      if (detailsEl) detailsEl.innerHTML = `Оба короля пали в ожесточенной битве на <b>${this.round} раунде</b>!`;
    } else if (isWin) {
      if (typeof sfx !== "undefined" && sfx.playFanfare) sfx.playFanfare();
      this.vibrate([100, 50, 150]);
      if (crownEl) crownEl.innerText = "♚";
      if (titleEl) {
        titleEl.innerText = "ШАХ И МАТ";
        titleEl.style.color = "#f1c40f";
      }
      if (subEl) subEl.innerText = "ВЕЛИКОЛЕПНАЯ ПОБЕДА";
      if (avatarEl) avatarEl.src = this.myHero.img;
      if (nameEl) nameEl.innerText = this.myHero.name;
      if (detailsEl) detailsEl.innerHTML = `Вы одержали триумф на <b>${this.round} раунде</b>!`;
    } else {
      if (typeof sfx !== "undefined" && sfx.playCheckmate) sfx.playCheckmate();
      this.vibrate(200);
      if (crownEl) crownEl.innerText = "♚";
      if (titleEl) {
        titleEl.innerText = "ПАРТИЯ ОКОНЧЕНА";
        titleEl.style.color = "#ff4d6d";
      }
      if (subEl) subEl.innerText = "ПОБЕДИЛ СОПЕРНИК";
      if (avatarEl) avatarEl.src = this.enemyHero.img;
      if (nameEl) nameEl.innerText = this.enemyHero.name;
      if (detailsEl) detailsEl.innerHTML = `Победу одержал оппонент на <b>${this.round} раунде</b>.`;
    }

    setTimeout(() => {
      victoryModal?.classList.add("active");
    }, 450);
  },

  closeVictoryModal() {
    InteractiveBoardEngine.stopTimer();
    document.getElementById("duel-victory-modal")?.classList.remove("active");
    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.display = "none";
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (typeof stopAllTargetVideosImmediate === "function") {
      stopAllTargetVideosImmediate();
    }
    this.lockActions(false);
  },

  fx(color) {
    const div = document.createElement("div");
    div.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 400);
  }
};