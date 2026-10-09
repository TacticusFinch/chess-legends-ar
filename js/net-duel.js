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

  // Открытие лобби и привязка параметров распознанной карты
  openLobby() {
    if (currentHeroId === null || typeof HEROES === "undefined" || !HEROES[currentHeroId]) {
      alert("Наведите камеру на карту гроссмейстера для инициализации дуэли.");
      return;
    }
    this.myHero = HEROES[currentHeroId];

    document.getElementById("lobby-step-select").style.display = "block";
    document.getElementById("lobby-step-host").style.display = "none";
    document.getElementById("lobby-step-join").style.display = "none";
    document.getElementById("duel-lobby-modal").classList.add("active");
  },

  // Закрытие лобби. disconnect = false при старте матча, чтобы не убить WebSocket
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

  // 1. Создание сессии (Хост)
  createRoom() {
    this.roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    document.getElementById("lobby-step-select").style.display = "none";
    document.getElementById("lobby-step-host").style.display = "block";
    document.getElementById("host-room-id").innerText = this.roomCode;

    // Генерация строгого монохромного QR-кода
    const joinUrl = `${window.location.origin}${window.location.pathname}?duel=${this.roomCode}`;
    const qrBox = document.getElementById("duel-qrcode");
    qrBox.innerHTML = "";
    
    if (typeof QRCode !== "undefined") {
      new QRCode(qrBox, {
        text: joinUrl,
        width: 140,
        height: 140,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M,
      });
    }

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
      // Отправляем серверу боевые характеристики из heroes-data.js
      this.socket.send(
        JSON.stringify({
          type: "READY",
          hero_id: currentHeroId,
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

  // Диспетчер турнирных событий
  handleServerMessage(data) {
    switch (data.type) {
      case "MATCH_START":
        this.enemyHero = data.enemy;
        this.closeLobby(false); // Закрываем модалку БЕЗ закрытия сокета
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
  // БОЕВАЯ АРЕНА И РАСЧЕТ ТАКТИКИ
  // ==========================================
  startBattle() {
    this.myHp = 100;
    this.enemyHp = 100;
    this.currentEnergy = 1;

    const overlay = document.getElementById("net-battle-overlay");
    overlay.style.display = "flex";

    // Установка имен гроссмейстеров
    document.getElementById("my-hero-name").innerText = this.myHero.name;
    document.getElementById("enemy-hero-name").innerText = this.enemyHero.name || "ГРОССМЕЙСТЕР";

    // Привязка названия коронного навыка конкретной карты
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
          this.chooseAction("defend"); // Автоматический позиционный блок в цейтноте
        }
      }
    }, 1000);
  },

  chooseAction(action) {
    if (this.myChoice) return;

    if (action === "skill" && this.currentEnergy < 2) {
      alert("Секретный навык не заряжен. Успешная Защита накапливает заряд.");
      return;
    }

    clearInterval(this.timerInterval);
    this.myChoice = action;
    this.enableButtons(false);

    document.getElementById("battle-log").innerText = "ХОД ЗАФИКСИРОВАН. ОЖИДАНИЕ СОПЕРНИКА...";

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

    // Кинематографичный отклик при уроне
    if (res.dmg_taken > 0) {
      this.triggerImpact();
      this.showDamageStrike("my", res.dmg_taken);
      if (navigator.vibrate) navigator.vibrate(120);
    }

    if (res.dmg_dealt > 0) {
      this.showDamageStrike("enemy", res.dmg_dealt);
      if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    }

    // Обновление шкал HP и Stockfish Eval-Bar
    this.updateHUD(this.myHp, this.enemyHp, res.energy);
    this.updateEvalBar(this.myHp, this.enemyHp);

    // Гроссмейстерская сводка раунда
    const actionNames = {
      attack: "АТАКА",
      defend: "ЗАЩИТА",
      skill: (this.enemyHero.skillName || "НАВЫК").toUpperCase()
    };

    const enemyAct = actionNames[res.enemy_action] || "ХОД";
    document.getElementById("battle-log").innerText = 
      `ОТВЕТ: ${enemyAct} | УРОН: -${res.dmg_dealt} HP | ПРИНЯТО: -${res.dmg_taken} HP`;

    // Завершение партии или переход к следующему тактическому рубежу
    if (this.myHp <= 0 || this.enemyHp <= 0) {
      setTimeout(() => {
        const isWin = this.myHp > this.enemyHp;
        if (typeof sfx !== "undefined") {
          if (isWin && sfx.playFanfare) sfx.playFanfare();
          else if (!isWin && sfx.playWrong) sfx.playWrong();
        }
        alert(isWin ? "ШАХ И МАТ. Победа по итогам тактического противостояния." : "ПОРАЖЕНИЕ. Ваш король капитулировал.");
        this.endBattle();
      }, 1200);
    } else {
      setTimeout(() => this.startRound(), 2600);
    }
  },

  // Мягкая виньетка удара
  triggerImpact() {
    const v = document.createElement("div");
    v.className = "flash-impact-vignette";
    document.body.appendChild(v);
    setTimeout(() => v.remove(), 400);
  },

  // Числовая нотация урона
  showDamageStrike(target, val) {
    const bar = target === "my" ? document.getElementById("my-hp-bar") : document.getElementById("enemy-hp-bar");
    if (!bar) return;

    const el = document.createElement("div");
    el.className = "floating-strike-num";
    el.innerText = `-${val}`;
    bar.parentElement.appendChild(el);
    setTimeout(() => el.remove(), 800);
  },

  // Расчет перевеса позиции (Eval Bar)
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

    if (cdBadge) cdBadge.innerText = `${energy}/2`;
    if (skillBtn) {
      if (energy >= 2) {
        skillBtn.classList.add("ready");
      } else {
        skillBtn.classList.remove("ready");
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
    document.getElementById("net-battle-overlay").style.display = "none";
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  },
};

// Запуск прослушивания при старте
document.addEventListener("DOMContentLoaded", () => NetDuel.init());