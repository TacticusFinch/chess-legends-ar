// ==========================================================
// СЕТЕВАЯ ДУЭЛЬ ЧЕМПИОНОВ (WebSocket через Amvera FastAPI)
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

  openLobby() {
    if (currentHeroId === null || typeof HEROES === "undefined" || !HEROES[currentHeroId]) {
      alert("Сначала наведите камеру на свою карточку гроссмейстера!");
      return;
    }
    this.myHero = HEROES[currentHeroId];

    document.getElementById("lobby-step-select").style.display = "block";
    document.getElementById("lobby-step-host").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "none";
    document.getElementById("duel-lobby-modal").classList.add("active");
  },

  // disconnect = true только при ручном закрытии или выходе
  closeLobby(disconnect = true) {
    document.getElementById("duel-lobby-modal").classList.remove("active");
    if (disconnect && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
      this.socket = null;
    }
  },

  showJoinInput() {
    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "block";
  },

  createRoom() {
    this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-host").style.display = "block";
    document.getElementById("host-room-id").innerText = this.roomCode;

    const joinUrl = `${window.location.origin}${window.location.pathname}?duel=${this.roomCode}`;
    const qrBox = document.getElementById("duel-qrcode");
    qrBox.innerHTML = "";
    new QRCode(qrBox, {
      text: joinUrl,
      width: 140,
      height: 140,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M,
    });

    this.connectWebSocket(this.roomCode);
  },

  joinRoomById() {
    const code = document.getElementById("join-room-input").value.trim();
    if (code.length === 4) {
      this.joinDuel(code);
    } else {
      alert("Введите 4 цифры кода комнаты!");
    }
  },

  joinDuel(code) {
    this.roomCode = code;
    this.connectWebSocket(code);
  },

  connectWebSocket(code) {
    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(`${this.WS_URL}${code}`);

    this.socket.onopen = () => {
      this.socket.send(
        JSON.stringify({
          type: "READY",
          hero_id: currentHeroId,
          hero: this.myHero,
        })
      );
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch (err) {
        console.error("Ошибка парсинга WS:", err);
      }
    };

    this.socket.onerror = (err) => {
      console.error("WS Ошибка:", err);
    };

    this.socket.onclose = () => {
      console.log("WebSocket отключен");
    };
  },

  handleServerMessage(data) {
    switch (data.type) {
      case "MATCH_START":
        this.enemyHero = data.enemy;
        this.closeLobby(false); // НЕ разрываем сокет при начале матча!
        this.startBattle();
        break;

      case "ROUND_RESULT":
        this.applyRoundResults(data);
        break;

      case "OPPONENT_DISCONNECTED":
        alert("Оппонент покинул бой!");
        this.endBattle();
        break;

      case "ERROR":
        alert(data.message);
        this.closeLobby(true);
        break;
    }
  },

  // ==========================================
  // БОЕВАЯ АРЕНА И ВИЗУАЛИЗАЦИЯ
  // ==========================================
  startBattle() {
    this.myHp = 100;
    this.enemyHp = 100;
    this.currentEnergy = 1;

    const overlay = document.getElementById("net-battle-overlay");
    overlay.style.display = "flex";
    document.getElementById("my-hero-name").innerText = this.myHero.name;
    document.getElementById("enemy-hero-name").innerText = this.enemyHero.name;

    this.updateHUD(100, 100, 1);
    this.startRound();
  },

  startRound() {
    this.myChoice = null;
    this.enableButtons(true);
    document.getElementById("battle-log").innerHTML = "⚡ Раунд начался! Выберите тактику:";

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
          this.chooseAction("defend"); // Автозащита при цейтноте
        }
      }
    }, 1000);
  },

  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Навык заряжается успешной Защитой!");
      return;
    }

    clearInterval(this.timerInterval);
    this.myChoice = action;
    this.enableButtons(false);

    document.getElementById("battle-log").innerHTML = "⏳ Ход сделан! Ожидание оппонента...";

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

    const overlay = document.getElementById("net-battle-overlay");

    // 1. Анимации урона и тряски экрана
    if (res.dmg_taken > 0) {
      overlay.classList.add("battle-hit-shake");
      this.triggerFlash("red");
      this.showDamage("my", res.dmg_taken);
      if (navigator.vibrate) navigator.vibrate(180);
    }

    if (res.dmg_dealt > 0) {
      this.showDamage("enemy", res.dmg_dealt);
      if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    }

    setTimeout(() => overlay.classList.remove("battle-hit-shake"), 500);

    // 2. Обновление шкал HP
    this.updateHUD(this.myHp, this.enemyHp, res.energy);

    // 3. Журнал хода с иконками
    const actionIcons = { attack: "⚔️ Штурм", defend: "🛡️ Защита", skill: "⚡ НАВЫК" };
    document.getElementById("battle-log").innerHTML = `
      Оппонент выбрал: <b>${actionIcons[res.enemy_action] || "..."}</b><br>
      Вы: <span style="color:#00e5ff">-${res.dmg_dealt} HP</span> | Вам: <span style="color:#ff4d6d">-${res.dmg_taken} HP</span>
    `;

    // 4. Проверка окончания боя или запуск следующего раунда
    if (this.myHp <= 0 || this.enemyHp <= 0) {
      setTimeout(() => {
        const isWin = this.myHp > this.enemyHp;
        if (typeof sfx !== "undefined") {
          if (isWin && sfx.playFanfare) sfx.playFanfare();
          else if (!isWin && sfx.playWrong) sfx.playWrong();
        }
        alert(isWin ? "🏆 ШАХ И МАТ! Вы сокрушили оппонента!" : "💀 ВАШ КОРОЛЬ ПАЛ! Поражение.");
        this.endBattle();
      }, 1200);
    } else {
      setTimeout(() => this.startRound(), 2500);
    }
  },

  triggerFlash(color) {
    const flash = document.createElement("div");
    flash.className = `battle-screen-flash flash-${color}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
  },

  showDamage(target, val) {
    const parent = target === "my" ? document.getElementById("my-hp-bar") : document.getElementById("enemy-hp-bar");
    if (!parent) return;

    const dmgEl = document.createElement("div");
    dmgEl.className = "floating-dmg";
    dmgEl.innerText = `-${val}`;
    parent.parentElement.appendChild(dmgEl);
    setTimeout(() => dmgEl.remove(), 900);
  },

  updateHUD(myHp, enemyHp, energy) {
    document.getElementById("my-hp-bar").style.width = `${myHp}%`;
    document.getElementById("my-hp-text").innerText = `${myHp} / 100`;
    document.getElementById("enemy-hp-bar").style.width = `${enemyHp}%`;
    document.getElementById("enemy-hp-text").innerText = `${enemyHp} / 100`;
    document.getElementById("skill-cd").innerText = `${energy}/2`;
  },

  enableButtons(enable) {
    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach((id) => {
      const b = document.getElementById(id);
      if (b) {
        b.disabled = !enable;
        b.style.pointerEvents = enable ? "auto" : "none";
        b.style.opacity = enable ? "1" : "0.45";
      }
    });
  },

  endBattle() {
    clearInterval(this.timerInterval);
    document.getElementById("net-battle-overlay").style.display = "none";
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => NetDuel.init());