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
  timerInterval: null,
  currentEnergy: 1,
  myHp: 100,
  enemyHp: 100,

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
    // Безопасное определение текущего героя с запасным вариантом (по умолчанию герой 0)
    let hid = 0;
    if (typeof currentHeroId !== "undefined" && currentHeroId !== null) {
      hid = currentHeroId;
    }
    
    if (typeof HEROES !== "undefined" && HEROES[hid]) {
      this.myHero = HEROES[hid];
    } else {
      this.myHero = { name: "Гроссмейстер", stats: [{ name: "Атака", val: 80 }, { name: "Защита", val: 75 }], skillName: "Коронный удар" };
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

  // 1. Создание сессии (Хост)
  createRoom() {
    this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-host").style.display = "block";
    document.getElementById("host-room-id").innerText = this.roomCode;

    this.connectWebSocket(this.roomCode);
  },

  // 2. Подключение к сессии (Гость)
  joinRoomById() {
    const input = document.getElementById("join-room-input");
    const code = input ? input.value.trim() : "";
    if (code.length === 4) {
      this.joinDuel(code);
    } else {
      alert("Введите 4 цифры идентификатора стола.");
    }
  },

  joinDuel(code) {
    if (!this.myHero) {
      let hid = (typeof currentHeroId !== "undefined" && currentHeroId !== null) ? currentHeroId : 0;
      this.myHero = (typeof HEROES !== "undefined" && HEROES[hid]) ? HEROES[hid] : { name: "Гроссмейстер", stats: [], skillName: "Коронный удар" };
    }
    this.roomCode = code;
    this.connectWebSocket(code);
  },

  // 3. Сетевое подключение
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
            skillName: this.myHero.skillName
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

  // Диспетчер сообщений от сервера
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

  startBattle() {
    this.myHp = 100;
    this.enemyHp = 100;
    this.currentEnergy = 1;

    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.setProperty("display", "flex", "important");

    // Имена
    document.getElementById("my-hero-name").innerText = this.myHero.name;
    document.getElementById("enemy-hero-name").innerText = this.enemyHero.name || "ГРОССМЕЙСТЕР";

    // Расчет примерного урона для отображения на кнопке Атаки
    let myAtk = 75;
    if (this.myHero.stats) {
      const atkObj = this.myHero.stats.find(s => s.name.toLowerCase().includes("атак"));
      if (atkObj) myAtk = parseInt(atkObj.val);
    }
    const approxDmg = Math.round(myAtk * 0.34);
    const atkDmgEl = document.getElementById("atk-stat-badge");
    if (atkDmgEl) atkDmgEl.innerText = `~${approxDmg} УРОНА`;

    // Привязка названия коронного навыка
    const skillTitleEl = document.getElementById("skill-action-title");
    if (skillTitleEl && this.myHero.skillName) {
      skillTitleEl.innerText = this.myHero.skillName.toUpperCase();
    }

    this.updateHUD(100, 100, 1);
    this.updateEvalBar(100, 100);
    this.startRound();
  },

  startRound() {
    this.myChoice = null;
    this.enableButtons(true);

    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.classList.remove("selected");
    });

    const clashEl = document.getElementById("clash-arena");
    if (clashEl) clashEl.style.display = "none";
    
    const timerWrap = document.getElementById("battle-timer-wrap");
    if (timerWrap) timerWrap.style.display = "block";
    
    document.getElementById("battle-log").innerText = "ОЦЕНКА ПОЗИЦИИ: СДЕЛАЙТЕ ХОД";

    let sec = 10;
    const timerEl = document.getElementById("battle-timer");
    timerEl.innerText = sec;
    timerEl.classList.remove("urgent");
    clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      sec--;
      timerEl.innerText = sec;
      if (sec <= 3) timerEl.classList.add("urgent");
      if (sec <= 0) {
        clearInterval(this.timerInterval);
        if (!this.myChoice) {
          this.chooseAction("defend"); // Авто-блок при цейтноте
        }
      }
    }, 1000);
  },

  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Коронный ход требует 2⚡ энергии! Нажмите Защиту 🛡️, чтобы накопить заряд.");
      return;
    }

    clearInterval(this.timerInterval);
    this.myChoice = action;

    const btnMap = { attack: "btn-action-atk", defend: "btn-action-def", skill: "btn-action-spc" };
    const btn = document.getElementById(btnMap[action]);
    if (btn) btn.classList.add("selected");

    this.enableButtons(false);
    document.getElementById("battle-log").innerText = "ХОД ЗАФИКСИРОВАН • ОЖИДАНИЕ ХОДА СОПЕРНИКА...";

    if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();

    this.socket.send(
      JSON.stringify({
        type: "MOVE",
        action: action,
      })
    );
  },

  applyRoundResults(res) {
    clearInterval(this.timerInterval);
    this.currentEnergy = res.energy;
    this.myHp = res.my_hp;
    this.enemyHp = res.enemy_hp;

    const timerWrap = document.getElementById("battle-timer-wrap");
    if (timerWrap) timerWrap.style.display = "none";

    const clashEl = document.getElementById("clash-arena");
    if (clashEl) clashEl.style.display = "flex";

    const icons = { attack: "⚔️", defend: "🛡️", skill: "⚡" };
    const titles = { 
      attack: "АТАКА", 
      defend: "ЗАЩИТА", 
      skill: (this.enemyHero.skillName || "НАВЫК").toUpperCase() 
    };

    const myIcon = document.getElementById("clash-my-icon");
    const myLabel = document.getElementById("clash-my-label");
    const enemyIcon = document.getElementById("clash-enemy-icon");
    const enemyLabel = document.getElementById("clash-enemy-label");

    if (myIcon) myIcon.innerText = icons[this.myChoice] || "⚔️";
    if (myLabel) myLabel.innerText = titles[this.myChoice] || "ХОД";
    if (enemyIcon) enemyIcon.innerText = icons[res.enemy_action] || "⚔️";
    if (enemyLabel) enemyLabel.innerText = titles[res.enemy_action] || "ХОД";

    let summary = "";
    if (this.myChoice === "defend" && res.enemy_action === "attack") {
      summary = `🛡️ Ваш блок сдержал удар! Получено всего -${res.dmg_taken} HP (+1⚡)`;
    } else if (this.myChoice === "attack" && res.enemy_action === "defend") {
      summary = `🛡️ Соперник закрылся щитом (-${res.dmg_dealt} HP)`;
    } else if (this.myChoice === "skill") {
      summary = `⚡ Вы пробили защиту коронным приемом! (-${res.dmg_dealt} HP)`;
    } else {
      summary = `⚔️ Размен ударами: вы -${res.dmg_dealt} HP | враг -${res.dmg_taken} HP`;
    }
    document.getElementById("battle-log").innerText = summary;

    if (res.dmg_taken > 0) {
      this.triggerImpact();
      this.showDamageStrike("my", res.dmg_taken);
      if (navigator.vibrate) navigator.vibrate(120);
    }

    if (res.dmg_dealt > 0) {
      this.showDamageStrike("enemy", res.dmg_dealt);
      if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    }

    this.updateHUD(this.myHp, this.enemyHp, res.energy);
    this.updateEvalBar(this.myHp, this.enemyHp);

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
      setTimeout(() => this.startRound(), 3200);
    }
  },

  triggerImpact() {
    const v = document.createElement("div");
    v.className = "flash-impact-vignette";
    document.body.appendChild(v);
    setTimeout(() => v.remove(), 400);
  },

  showDamageStrike(target, val) {
    const bar = target === "my" ? document.getElementById("my-hp-bar") : document.getElementById("enemy-hp-bar");
    if (!bar) return;

    const el = document.createElement("div");
    el.className = "floating-strike-num";
    el.innerText = `-${val}`;
    bar.parentElement.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

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

  updateHUD(myHp, enemyHp, energy) {
    document.getElementById("my-hp-bar").style.width = `${myHp}%`;
    document.getElementById("my-hp-text").innerText = `${myHp} / 100 HP`;
    document.getElementById("enemy-hp-bar").style.width = `${enemyHp}%`;
    document.getElementById("enemy-hp-text").innerText = `${enemyHp} / 100 HP`;

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
    clearInterval(this.timerInterval);
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