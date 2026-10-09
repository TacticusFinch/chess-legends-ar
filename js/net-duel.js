// ==========================================================
// СЕТЕВАЯ ДУЭЛЬ ЧЕМПИОНОВ (WebSocket через Amvera FastAPI)
// ==========================================================

const NetDuel = {
  // Замените адрес на фактический домен вашего сервиса на Amvera
  WS_URL: "wss://inference.waw0.amvera.ru/ws/duel/",

  socket: null,
  roomCode: null,
  myHero: null,
  enemyHero: null,
  myChoice: null,
  timerInterval: null,
  currentEnergy: 1,
  myHp: 100,
  enemyHp: 100,

  // Инициализация (проверка ссылки с параметром ?duel=XXXX)
  init() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('duel');
    if (code) {
      setTimeout(() => {
        this.openLobby();
        this.joinDuel(code);
      }, 700);
    }
  },

  // Открыть модальное окно лобби
  openLobby() {
    if (currentHeroId === null || typeof HEROES === "undefined" || !HEROES[currentHeroId]) {
      alert("Сначала наведите камеру на свою карточку гроссмейстера!");
      return;
    }
    this.myHero = HEROES[currentHeroId];
    
    // Сброс шагов интерфейса
    document.getElementById("lobby-step-select").style.display = "block";
    document.getElementById("lobby-step-host").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "none";
    document.getElementById("duel-lobby-modal").classList.add("active");
  },

  closeLobby() {
    document.getElementById("duel-lobby-modal").classList.remove("active");
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.close();
    }
  },

  showJoinInput() {
    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "block";
  },

  // 1. Создание комнаты (Хост)
  createRoom() {
    this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    this.connectWebSocket(this.roomCode);

    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-host").style.display = "block";
    document.getElementById("host-room-id").innerText = this.roomCode;

    // Генерируем QR-код со ссылкой
    const joinUrl = `${window.location.origin}${window.location.pathname}?duel=${this.roomCode}`;
    const qrBox = document.getElementById("duel-qrcode");
    qrBox.innerHTML = "";
    new QRCode(qrBox, {
      text: joinUrl,
      width: 140,
      height: 140,
      colorDark: "#111111",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });
  },

  // 2. Вход по 4-значному коду
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

  // 3. Подключение по WebSocket
  connectWebSocket(code) {
    if (this.socket) {
      this.socket.close();
    }

    this.socket = new WebSocket(`${this.WS_URL}${code}`);

    this.socket.onopen = () => {
      // Отправляем готовность и данные своего чемпиона
      this.socket.send(JSON.stringify({
        type: "READY",
        hero_id: currentHeroId,
        hero: this.myHero
      }));
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
      console.error("Ошибка связи:", err);
      alert("Ошибка подключения к серверу боевой арены!");
    };

    this.socket.onclose = () => {
      console.log("WebSocket-соединение завершено");
    };
  },

  // Маршрутизатор сообщений сервера
  handleServerMessage(data) {
    switch (data.type) {
      case "MATCH_START":
        this.enemyHero = data.enemy;
        this.closeLobby();
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
        this.closeLobby();
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

    document.getElementById("net-battle-overlay").style.display = "flex";
    document.getElementById("my-hero-name").innerText = this.myHero.name;
    document.getElementById("enemy-hero-name").innerText = this.enemyHero.name;

    this.updateHUD(100, 100, 1);
    this.startRound();
  },

  startRound() {
    this.myChoice = null;
    this.enableButtons(true);
    document.getElementById("battle-log").innerText = "Выберите действие!";

    let sec = 10;
    const timerEl = document.getElementById("battle-timer");
    timerEl.innerText = sec;
    clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      sec--;
      timerEl.innerText = sec;
      if (sec <= 0) {
        clearInterval(this.timerInterval);
        if (!this.myChoice) {
          this.chooseAction("defend"); // Авто-защита при цейтноте
        }
      }
    }, 1000);
  },

  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Секретный навык еще не готов! Заряжайте его успешной Защитой.");
      return;
    }

    this.myChoice = action;
    this.enableButtons(false);
    document.getElementById("battle-log").innerText = "Ожидание хода оппонента...";

    if (typeof sfx !== "undefined" && sfx.playMove) {
      sfx.playMove();
    }

    this.socket.send(JSON.stringify({
      type: "MOVE",
      action: action
    }));
  },

  applyRoundResults(res) {
    clearInterval(this.timerInterval);
    this.currentEnergy = res.energy;
    this.myHp = res.my_hp;
    this.enemyHp = res.enemy_hp;

    this.updateHUD(this.myHp, this.enemyHp, res.energy);

    if (navigator.vibrate && res.dmg_taken > 0) {
      navigator.vibrate(180);
    }

    const actionIcons = { attack: "⚔️ Штурм", defend: "🛡️ Блок", skill: "⚡ НАВЫК" };
    document.getElementById("battle-log").innerHTML = 
      `Оппонент: ${actionIcons[res.enemy_action]}<br>` +
      `Вы нанесли: <b style="color:#00e5ff">-${res.dmg_dealt}</b> | Получили: <b style="color:#ff4d6d">-${res.dmg_taken}</b>`;

    if (this.myHp <= 0 || this.enemyHp <= 0) {
      setTimeout(() => {
        const isWin = this.myHp > this.enemyHp;
        if (typeof sfx !== "undefined") {
          if (isWin && sfx.playFanfare) sfx.playFanfare();
          else if (!isWin && sfx.playWrong) sfx.playWrong();
        }
        alert(isWin ? "🏆 ШАХ И МАТ! Вы победили гроссмейстера!" : "💀 ВАШ КОРОЛЬ ПАЛ! Поражение.");
        this.endBattle();
      }, 1500);
    } else {
      setTimeout(() => this.startRound(), 2500);
    }
  },

  updateHUD(myHp, enemyHp, energy) {
    document.getElementById("my-hp-bar").style.width = myHp + "%";
    document.getElementById("my-hp-text").innerText = `${myHp} / 100`;
    document.getElementById("enemy-hp-bar").style.width = enemyHp + "%";
    document.getElementById("enemy-hp-text").innerText = `${enemyHp} / 100`;
    document.getElementById("skill-cd").innerText = `${energy}/2`;
  },

  enableButtons(enable) {
    ["btn-action-atk", "btn-action-def", "btn-action-spc"].forEach(id => {
      const b = document.getElementById(id);
      if (b) {
        b.disabled = !enable;
        b.style.opacity = enable ? "1" : "0.4";
      }
    });
  },

  endBattle() {
    clearInterval(this.timerInterval);
    document.getElementById("net-battle-overlay").style.display = "none";
    if (this.socket) {
      this.socket.close();
    }
  }
};

document.addEventListener("DOMContentLoaded", () => NetDuel.init());