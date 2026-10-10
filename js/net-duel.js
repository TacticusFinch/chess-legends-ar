// ==========================================================
// СЕТЕВАЯ ДУЭЛЬ ГРОССМЕЙСТЕРОВ (TACTICUS FINCH PRO AR)
// ==========================================================

const NetDuel = {
  WS_URL: "wss://chesslegendsai-tacticusfinch.mia0.amvera.tech/ws/duel/",

  socket: null,
  roomCode: null,
  myHero: null,
  enemyHero: null,
  myChoice: null,
  currentEnergy: 1,
  enemyEnergy: 1,
  myHp: 100,
  enemyHp: 100,
  roundCount: 1,

  // Параметры интерактивной тактической доски
  pendingAction: null,
  currentPuzzle: null,
  selectedSquare: null,
  isCritEarned: false,

  // База мини-задач (Мат в 1 ход)
  TACTIC_PUZZLES: [
    {
      // Детский мат ферзем на f7
      fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR",
      from: "h5",
      to: "f7"
    },
    {
      // Мат ладьей по 8-й горизонтали
      fen: "6k1/5ppp/8/8/8/8/8/3R2K1",
      from: "d1",
      to: "d8"
    },
    {
      // Мат конем (спертый мат королю на h8)
      fen: "7k/6pp/8/8/5N2/8/8/6K1",
      from: "f4",
      to: "g6"
    }
  ],

  // Инициализация при загрузке страницы (проверка URL ?duel=XXXX)
  init() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("duel");
    if (code) {
      setTimeout(() => {
        this.openLobby();
        this.joinDuel(code);
      }, 700);
    }
  },

  // Открытие лобби и привязка параметров карты
  openLobby() {
    let hid = 0;
    if (typeof currentHeroId !== "undefined" && currentHeroId !== null) {
      hid = currentHeroId;
    }
    
    if (typeof HEROES !== "undefined" && HEROES[hid]) {
      this.myHero = HEROES[hid];
    } else {
      this.myHero = { 
        name: "Гроссмейстер", 
        stats: [{ name: "Атака", val: 80 }, { name: "Защита", val: 75 }], 
        skillName: "Коронный удар" 
      };
    }

    const selectStep = document.getElementById("lobby-step-select");
    const hostStep = document.getElementById("lobby-step-host");
    const joinStep = document.getElementById("lobby-step-join");
    const modal = document.getElementById("duel-lobby-modal");

    if (selectStep) selectStep.style.display = "block";
    if (hostStep) hostStep.style.display = "none";
    if (joinStep) joinStep.style.display = "none";
    if (modal) modal.classList.add("active");
  },

  // Закрытие лобби
  closeLobby(disconnect = true) {
    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.remove("active");
    if (disconnect && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.socket = null;
    }
  },

  showJoinInput() {
    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "block";
    const input = document.getElementById("join-room-input");
    if (input) {
      input.value = "";
      setTimeout(() => input.focus(), 100);
    }
  },

  // 1. Создание стола (Хост)
  createRoom() {
    this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-host").style.display = "block";
    document.getElementById("host-room-id").innerText = this.roomCode;

    this.connectWebSocket(this.roomCode);
  },

  // 2. Вход по 4-значному коду (Гость)
  joinRoomById() {
    const input = document.getElementById("join-room-input");
    const code = input ? input.value.trim() : "";
    if (code.length === 4) {
      // Показываем игроку статус подключения
      const btn = event?.target || document.querySelector("#lobby-step-join .duel-primary-btn");
      if (btn) {
        btn.innerText = "Подключение...";
        btn.disabled = true;
      }
      this.joinDuel(code);
    } else {
      alert("Введите 4 цифры номера стола.");
    }
  },

  joinDuel(code) {
    if (!this.myHero) {
      let hid = (typeof currentHeroId !== "undefined" && currentHeroId !== null) ? currentHeroId : 0;
      this.myHero = (typeof HEROES !== "undefined" && HEROES[hid]) 
        ? HEROES[hid] 
        : { name: "Гроссмейстер", stats: [], skillName: "Коронный удар" };
    }
    this.roomCode = code;
    this.connectWebSocket(code);
  },

  // 3. Сетевое подключение WebSocket
  connectWebSocket(code) {
    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(`${this.WS_URL}${code}`);

    this.socket.onopen = () => {
      let hid = (typeof currentHeroId !== "undefined" && currentHeroId !== null) ? currentHeroId : 0;
      this.socket.send(
        JSON.stringify({
          type: "READY",
          hero_id: hid,
          hero: {
            name: this.myHero.name,
            stats: this.myHero.stats,
            skillName: this.myHero.skillName,
            avatar: this.myHero.avatar || this.myHero.photo || this.myHero.image || this.myHero.img || ""
          }
        })
      );
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch (err) {
        console.error("Ошибка парсинга пакета дуэли:", err);
      }
    };

    this.socket.onerror = (err) => {
      console.error("Сбой соединения дуэли:", err);
      const btn = document.querySelector("#lobby-step-join .duel-primary-btn");
      if (btn) {
        btn.innerText = "Начать";
        btn.disabled = false;
      }
      alert("Не удалось подключиться к столу. Проверьте код или статус сервера.");
    };

    this.socket.onclose = () => {
      console.log("Сессия дуэли деактивирована");
    };
  },

  // Диспетчер турнирных событий
  handleServerMessage(data) {
    switch (data.type) {
      case "MATCH_START":
        this.enemyHero = data.enemy;
        this.closeLobby(false);
        this.startBattle();
        break;

      case "ROUND_RESULT":
        this.applyRoundResults(data);
        break;

      case "OPPONENT_DISCONNECTED":
        alert("Оппонент покинул партию.");
        this.endBattle();
        break;

      case "ERROR":
        alert(data.message);
        this.closeLobby(true);
        break;
    }
  },

  // ==========================================
  // БОЕВАЯ АРЕНА
  // ==========================================
  startBattle() {
    this.myHp = 100;
    this.enemyHp = 100;
    this.currentEnergy = 1;
    this.enemyEnergy = 1;
    this.roundCount = 1;

    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.setProperty("display", "flex", "important");

    // 1. Имена
    const myNameEl = document.getElementById("my-hero-name");
    const enemyNameEl = document.getElementById("enemy-hero-name");
    if (myNameEl) myNameEl.innerText = this.myHero.name;
    if (enemyNameEl) enemyNameEl.innerText = this.enemyHero.name || "ГРОССМЕЙСТЕР";

    // 2. Портреты гроссмейстеров
    const getHeroAvatar = (h) => (h ? (h.avatar || h.photo || h.image || h.img || "") : "");
    const myImg = document.getElementById("my-avatar-img");
    const enemyImg = document.getElementById("enemy-avatar-img");
    if (myImg) myImg.src = getHeroAvatar(this.myHero);
    if (enemyImg) enemyImg.src = getHeroAvatar(this.enemyHero);

    // 3. Вычисление и отображение статов карт
    const getStat = (h, key, defVal) => {
      if (!h || !h.stats) return defVal;
      const s = h.stats.find(item => item.name && item.name.toLowerCase().includes(key));
      return s ? parseInt(s.val) : defVal;
    };

    const myAtk = getStat(this.myHero, "атак", 75);
    const myDef = getStat(this.myHero, "защит", 70);
    const enemyAtk = getStat(this.enemyHero, "атак", 75);
    const enemyDef = getStat(this.enemyHero, "защит", 70);

    const myAtkEl = document.getElementById("my-atk-val");
    const myDefEl = document.getElementById("my-def-val");
    const enemyAtkEl = document.getElementById("enemy-atk-val");
    const enemyDefEl = document.getElementById("enemy-def-val");

    if (myAtkEl) myAtkEl.innerText = myAtk;
    if (myDefEl) myDefEl.innerText = myDef;
    if (enemyAtkEl) enemyAtkEl.innerText = enemyAtk;
    if (enemyDefEl) enemyDefEl.innerText = enemyDef;

    // Название супернавыка соперника
    const enemySkillEl = document.getElementById("enemy-skill-name");
    if (enemySkillEl) {
      enemySkillEl.innerText = (this.enemyHero.skillName || "НАВЫК").substring(0, 10).toUpperCase();
    }

    // Подсказки на боевых кнопках игрока
    const atkBadge = document.getElementById("atk-stat-badge");
    const defBadge = document.getElementById("def-stat-badge");
    if (atkBadge) atkBadge.innerText = `~${Math.round(myAtk * 0.34)} УРОНА`;
    if (defBadge) defBadge.innerText = `Блок ~${Math.round(myDef / 2)}%`;

    const skillTitleEl = document.getElementById("skill-action-title");
    if (skillTitleEl) {
      skillTitleEl.innerText = (this.myHero.skillName || "КОРОННЫЙ ХОД").toUpperCase();
    }

    this.updateHUD(100, 100, 1);
    this.updateEvalBar(100, 100);
    this.startRound();
  },

  // Начало раунда (БЕЗ ТАЙМЕРА — игра ждет решений игроков)
  startRound() {
    this.myChoice = null;
    this.enableButtons(true);

    // Сброс подсветки кнопок, щитов и доски
    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.classList.remove("selected");
    });

    const playerShield = document.getElementById("player-shield-fx");
    const enemyShield = document.getElementById("enemy-shield-fx");
    if (playerShield) playerShield.style.display = "none";
    if (enemyShield) enemyShield.style.display = "none";

    const boardModal = document.getElementById("tactic-board-modal");
    if (boardModal) boardModal.style.display = "none";

    const roundBadge = document.getElementById("round-title-badge");
    if (roundBadge) roundBadge.innerText = `РАУНД ${this.roundCount || 1}`;

    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.innerText = "ВАШ ХОД: ВЫБЕРИТЕ ДЕЙСТВИЕ";
  },

  // Выбор действия: если Атака — открываем доску для крита
  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Коронный ход требует 2⚡ энергии! Нажмите Защиту 🛡️, чтобы накопить заряд.");
      return;
    }

    this.enableButtons(false);
    const btnMap = { attack: "btn-action-atk", defend: "btn-action-def", skill: "btn-action-spc" };
    const btn = document.getElementById(btnMap[action]);
    if (btn) btn.classList.add("selected");

    this.pendingAction = action;

    if (action === "attack") {
      const randPuzzle = this.TACTIC_PUZZLES[Math.floor(Math.random() * this.TACTIC_PUZZLES.length)];
      this.renderInteractiveBoard(randPuzzle);
    } else {
      this.isCritEarned = false;
      this.executeActionAfterPuzzle();
    }
  },

  // Отрисовка интерактивной доски 8х8
  renderInteractiveBoard(puzzle) {
    this.currentPuzzle = puzzle;
    this.selectedSquare = null;
    this.isCritEarned = false;

    const boardEl = document.getElementById("chess-interactive-board");
    if (!boardEl) return;
    boardEl.innerHTML = "";

    const pieceSymbols = {
      p: "♟", r: "♜", n: "♞", b: "♝", q: "♛", k: "♚",
      P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"
    };

    const rows = puzzle.fen.split("/");
    const boardState = [];

    for (let r = 0; r < 8; r++) {
      const row = rows[r];
      const parsedRow = [];
      for (let ch of row) {
        if (!isNaN(ch)) {
          for (let i = 0; i < parseInt(ch); i++) parsedRow.push(null);
        } else {
          parsedRow.push(ch);
        }
      }
      boardState.push(parsedRow);
    }

    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sqName = `${files[c]}${8 - r}`;
        const sq = document.createElement("div");
        sq.className = `sq ${(r + c) % 2 === 0 ? "white" : "black"}`;
        sq.dataset.square = sqName;

        const pieceChar = boardState[r][c];
        if (pieceChar) {
          const isWhite = pieceChar === pieceChar.toUpperCase();
          const pDiv = document.createElement("div");
          pDiv.className = `piece ${isWhite ? "white-p" : "black-p"}`;
          pDiv.innerText = pieceSymbols[pieceChar] || "";
          sq.appendChild(pDiv);
        }

        sq.addEventListener("click", () => this.handleBoardClick(sqName));
        boardEl.appendChild(sq);
      }
    }

    const modal = document.getElementById("tactic-board-modal");
    if (modal) modal.style.display = "flex";
  },

  // Управление касаниями (Tap-to-Move)
  handleBoardClick(sqName) {
    const allSquares = document.querySelectorAll(".sq");

    // 1-й тап: выбор фигуры (белой)
    if (!this.selectedSquare) {
      const targetSq = Array.from(allSquares).find(s => s.dataset.square === sqName);
      if (targetSq && targetSq.querySelector(".white-p")) {
        this.selectedSquare = sqName;
        targetSq.classList.add("selected");
      }
      return;
    }

    // 2-й тап: ход на клетку
    const fromSq = this.selectedSquare;
    const toSq = sqName;
    this.selectedSquare = null;
    allSquares.forEach(s => s.classList.remove("selected"));

    // Проверка правильности мата
    if (fromSq === this.currentPuzzle.from && toSq === this.currentPuzzle.to) {
      this.isCritEarned = true;
      this.triggerFlash("gold");
      if (typeof sfx !== "undefined" && sfx.playFanfare) sfx.playFanfare();
      document.getElementById("battle-log").innerText = "💥 ШАХМАТНЫЙ КРИТ! МАТ НАЙДЕН!";
    } else {
      document.getElementById("battle-log").innerText = "Мат упущен. Обычная атака.";
    }

    // Закрываем доску и отправляем ход
    setTimeout(() => {
      const modal = document.getElementById("tactic-board-modal");
      if (modal) modal.style.display = "none";
      this.executeActionAfterPuzzle();
    }, 600);
  },

  // Отправка хода на сервер после решения задачи
  executeActionAfterPuzzle() {
    this.myChoice = this.pendingAction;
    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.innerText = "ХОД ЗАФИКСИРОВАН • ОЖИДАНИЕ ХОДА СОПЕРНИКА...";

    if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();

    this.socket.send(
      JSON.stringify({
        type: "MOVE",
        action: this.myChoice,
        crit: this.isCritEarned
      })
    );
  },

  // Применение и анимация результатов раунда
  applyRoundResults(res) {
    this.currentEnergy = res.energy;
    this.myHp = res.my_hp;
    this.enemyHp = res.enemy_hp;

    // Трекер заряда навыка у соперника
    if (res.enemy_action === "defend") {
      this.enemyEnergy = Math.min(2, (this.enemyEnergy || 1) + 1);
    } else if (res.enemy_action === "skill") {
      this.enemyEnergy = 0;
    }
    const enemyEnergyEl = document.getElementById("enemy-energy-tracker");
    if (enemyEnergyEl) enemyEnergyEl.innerText = `${this.enemyEnergy}/2 ⚡`;

    // 1. АНИМАЦИИ ВЫПАДОВ КАРТ И НЕОНОВЫХ ЩИТОВ
    const playerCard = document.getElementById("player-card-anchor");
    const enemyCard = document.getElementById("enemy-card-anchor");
    const playerShield = document.getElementById("player-shield-fx");
    const enemyShield = document.getElementById("enemy-shield-fx");

    // Анимация действий игрока
    if (this.myChoice === "attack" && playerCard) {
      playerCard.classList.add("anim-lunge-up");
      setTimeout(() => playerCard.classList.remove("anim-lunge-up"), 700);
    } else if (this.myChoice === "skill" && playerCard) {
      playerCard.classList.add("anim-skill-blast");
      setTimeout(() => playerCard.classList.remove("anim-skill-blast"), 900);
    } else if (this.myChoice === "defend" && playerShield) {
      playerShield.style.display = "flex";
    }

    // Анимация действий соперника
    if (res.enemy_action === "attack" && enemyCard) {
      enemyCard.classList.add("anim-lunge-down");
      setTimeout(() => enemyCard.classList.remove("anim-lunge-down"), 700);
    } else if (res.enemy_action === "skill" && enemyCard) {
      enemyCard.classList.add("anim-skill-blast");
      setTimeout(() => enemyCard.classList.remove("anim-skill-blast"), 900);
    } else if (res.enemy_action === "defend" && enemyShield) {
      enemyShield.style.display = "flex";
    }

    // 2. Вспышки и тактильная отдача
    if (this.myChoice === "skill" || res.enemy_action === "skill") {
      this.triggerFlash("gold");
      this.triggerShake("heavy");
      if (navigator.vibrate) navigator.vibrate([80, 50, 150]);
    } else if (res.dmg_taken > 0) {
      this.triggerFlash("red");
      this.triggerShake("light");
      if (navigator.vibrate) navigator.vibrate(120);
    } else if (this.myChoice === "defend") {
      this.triggerFlash("cyan");
      if (navigator.vibrate) navigator.vibrate([30, 40]);
    }

    // 3. Вылетающие цифры урона
    if (res.dmg_taken > 0) this.showDamageStrike("my", res.dmg_taken);
    if (res.dmg_dealt > 0) {
      this.showDamageStrike("enemy", res.dmg_dealt);
      if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    }

    // 4. Понятная сводка раунда для детей
    let summary = "";
    if (this.myChoice === "defend" && res.enemy_action === "attack") {
      summary = `🛡️ Ваш щит поглотил удар! (-${res.dmg_taken} HP) | +1⚡`;
    } else if (this.myChoice === "attack" && res.enemy_action === "defend") {
      summary = `🛡️ Соперник выставил блок (-${res.dmg_dealt} HP)`;
    } else if (this.myChoice === "skill") {
      summary = `⚡ СУПЕРАТАКА ПРОБИЛА ЗАЩИТУ! (-${res.dmg_dealt} HP)`;
    } else {
      summary = `⚔️ Размен: вы -${res.dmg_dealt} HP | вам -${res.dmg_taken} HP`;
    }
    
    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.innerText = summary;

    this.updateHUD(this.myHp, this.enemyHp, res.energy);
    this.updateEvalBar(this.myHp, this.enemyHp);

    // Завершение или переход к следующему раунду
    if (this.myHp <= 0 || this.enemyHp <= 0) {
      setTimeout(() => {
        const isWin = this.myHp > this.enemyHp;
        if (typeof sfx !== "undefined") {
          if (isWin && sfx.playFanfare) sfx.playFanfare();
          else if (!isWin && sfx.playWrong) sfx.playWrong();
        }
        alert(isWin ? "🏆 ШАХ И МАТ! Ваш гроссмейстер одержал победу!" : "ПОРАЖЕНИЕ. Ваш король повержен.");
        this.endBattle();
      }, 1500);
    } else {
      this.roundCount = (this.roundCount || 1) + 1;
      setTimeout(() => this.startRound(), 3200);
    }
  },

  // Тряска экрана (Screen Shake)
  triggerShake(intensity = "light") {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;
    overlay.classList.remove("shake-light", "shake-heavy");
    void overlay.offsetWidth;
    overlay.classList.add(intensity === "heavy" ? "shake-heavy" : "shake-light");
    setTimeout(() => overlay.classList.remove("shake-light", "shake-heavy"), 450);
  },

  // Цветные вспышки ударов
  triggerFlash(color = "red") {
    const flash = document.createElement("div");
    flash.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 450);
  },

  // Нотация вылетающего урона
  showDamageStrike(target, val) {
    const bar = target === "my" ? document.getElementById("my-hp-bar") : document.getElementById("enemy-hp-bar");
    if (!bar) return;

    const el = document.createElement("div");
    el.className = "floating-strike-num";
    el.innerText = `-${val}`;
    bar.parentElement.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

  // Оценочная шкала перевеса сил (Eval Bar)
  updateEvalBar(myHp, enemyHp) {
    const total = myHp + enemyHp;
    const myPercent = total > 0 ? (myHp / total) * 100 : 50;

    const fill = document.getElementById("duel-eval-fill");
    const score = document.getElementById("duel-eval-score");

    if (fill) fill.style.height = `${myPercent}%`;
    if (score) {
      const diff = ((myHp - enemyHp) / 10).toFixed(1);
      score.innerText = diff > 0 ? `+${diff}` : `${diff}`;
      score.style.color = diff >= 0 ? "#ffffff" : "#ef4444";
    }
  },

  // Обновление шкал здоровья и готовности суперудара
  updateHUD(myHp, enemyHp, energy) {
    const myBar = document.getElementById("my-hp-bar");
    const myText = document.getElementById("my-hp-text");
    const enemyBar = document.getElementById("enemy-hp-bar");
    const enemyText = document.getElementById("enemy-hp-text");

    if (myBar) myBar.style.width = `${myHp}%`;
    if (myText) myText.innerText = `${myHp} / 100 HP`;
    if (enemyBar) enemyBar.style.width = `${enemyHp}%`;
    if (enemyText) enemyText.innerText = `${enemyHp} / 100 HP`;

    const energyValEl = document.getElementById("my-energy-val");
    if (energyValEl) energyValEl.innerText = `${energy}/2 ⚡`;

    const cdBadge = document.getElementById("skill-cd-badge");
    const skillBtn = document.getElementById("btn-action-spc");
    const skillSub = document.getElementById("skill-action-sub");

    if (cdBadge) cdBadge.innerText = `${energy}/2 ⚡`;
    if (skillBtn) {
      if (energy >= 2) {
        skillBtn.classList.add("ready");
        if (skillSub) skillSub.innerText = "ГОТОВ! ПРОБИВАЕТ БЛОК";
      } else {
        skillBtn.classList.remove("ready");
        if (skillSub) skillSub.innerText = `Нужно 2⚡ (Защита дает +1⚡)`;
      }
    }
  },

  enableButtons(enable) {
    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.disabled = !enable;
        btn.style.pointerEvents = enable ? "auto" : "none";
        btn.style.opacity = enable ? "1" : "0.35";
      }
    });
  },

  endBattle() {
    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.setProperty("display", "none", "important");
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
};

// Запуск прослушивания при старте
document.addEventListener("DOMContentLoaded", () => NetDuel.init());