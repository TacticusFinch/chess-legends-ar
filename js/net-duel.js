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

    // Сброс подсветки кнопок и щитов
    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.classList.remove("selected");
    });

    const playerShield = document.getElementById("player-shield-fx");
    const enemyShield = document.getElementById("enemy-shield-fx");
    if (playerShield) playerShield.style.display = "none";
    if (enemyShield) enemyShield.style.display = "none";

    const roundBadge = document.getElementById("round-title-badge");
    if (roundBadge) roundBadge.innerText = `РАУНД ${this.roundCount || 1}`;

    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.innerText = "ВАШ ХОД: ВЫБЕРИТЕ ДЕЙСТВИЕ";
  },

  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Коронный ход требует 2⚡ энергии! Нажмите Защиту 🛡️, чтобы накопить заряд.");
      return;
    }

    this.myChoice = action;

    const btnMap = { attack: "btn-action-atk", defend: "btn-action-def", skill: "btn-action-spc" };
    const btn = document.getElementById(btnMap[action]);
    if (btn) btn.classList.add("selected");

    this.enableButtons(false);
    
    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.innerText = "ХОД ЗАФИКСИРОВАН • ОЖИДАНИЕ ХОДА СОПЕРНИКА...";

    if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();

    this.socket.send(
      JSON.stringify({
        type: "MOVE",
        action: action,
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
    void overlay.offsetWidth; // Force reflow для перезапуска CSS-анимации
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