/**
 * Тактикус Финч — Модуль Сетевой Дуэли и QTE-Фокуса
 */

const AMVERA_HOST = "chesslegendsai-tacticusfinch.mia0.amvera.tech"; 

// Автоматический выбор протокола (wss:// для https, ws:// для http/localhost)
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss:" : "ws:";
const WS_SERVER_HOST = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? `ws://${window.location.hostname}:8000`
  : `${WS_PROTOCOL}//${AMVERA_HOST}`;

/* ================= QTE ДВИЖОК «ФОКУС ГРОССМЕЙСТЕРА» ================= */
const QTEFocusEngine = {
  cursorEl: null,
  trackWidth: 260,
  pos: 0,
  speed: 4,
  direction: 1,
  animFrame: null,
  isStopped: false,

  start() {
    const modal = document.getElementById("qte-focus-modal");
    this.cursorEl = document.getElementById("qte-cursor");
    if (!modal || !this.cursorEl) return;

    modal.style.display = "flex";
    this.pos = 0;
    this.speed = 4.5;
    this.direction = 1;
    this.isStopped = false;

    const loop = () => {
      if (this.isStopped) return;
      this.pos += this.speed * this.direction;
      if (this.pos >= this.trackWidth - 14) this.direction = -1;
      if (this.pos <= 0) this.direction = 1;
      this.cursorEl.style.transform = `translateX(${this.pos}px)`;
      this.animFrame = requestAnimationFrame(loop);
    };
    this.animFrame = requestAnimationFrame(loop);
  },

  hit() {
    if (this.isStopped) return false;
    this.isStopped = true;
    cancelAnimationFrame(this.animFrame);

    // Центр трека 130px. Зона крита: 110px - 150px (+-20px)
    const center = this.trackWidth / 2;
    const isCrit = Math.abs(this.pos + 7 - center) <= 20;

    const modal = document.getElementById("qte-focus-modal");
    setTimeout(() => {
      if (modal) modal.style.display = "none";
    }, 350);

    return isCrit;
  }
};

/* ================= ОСНОВНОЙ МОДУЛЬ ДУЭЛЕЙ ================= */
window.NetDuel = {
  ws: null,
  isNetworkMode: false,
  round: 1,
  myHp: 100,
  enemyHp: 100,
  myEnergy: 1,
  enemyEnergy: 1,
  isShieldActive: false,
  enemyShieldActive: false,

  myHero: null,
  enemyHero: null,

  // Проверка и захват выбранного персонажа
  detectCurrentHero() {
    if (window.currentHeroData) {
      const h = window.currentHeroData;
      const atkObj = h.stats?.find(s => s.name && s.name.toLowerCase().includes("атак"));
      const defObj = h.stats?.find(s => s.name && s.name.toLowerCase().includes("защит"));

      this.myHero = {
        name: h.name || "Гроссмейстер",
        img: h.avatar || (h.id !== undefined ? `./assets/avatars/${h.id}.jpg` : "./assets/avatars/0.jpg"),
        atk: atkObj ? Math.round(atkObj.val * 0.35) : 25,
        def: defObj ? Math.round(defObj.val * 0.25) : 15,
        skillName: h.skill || "Коронный удар"
      };
      return true;
    }
    return false;
  },

  openLobby() {
    // 1. Проверяем, отсканирована ли карта
    const hasHero = this.detectCurrentHero();
    if (!hasHero) {
      alert("Сначала наведите камеру на карточку гроссмейстера, чтобы он ожил и встал во главе вашей армии!");
      return;
    }

    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.add("active");
    this.showStep("lobby-step-select");
  },

  closeLobby() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.remove("active");
  },

  showStep(id) {
    ["lobby-step-select", "lobby-step-host", "lobby-step-join"].forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? "block" : "none";
    });
  },

  createRoom() {
    this.showStep("lobby-step-host");
    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    const codeEl = document.getElementById("host-room-id");
    if (codeEl) codeEl.textContent = roomCode;

    const waitStatus = document.querySelector(".duel-wait-status");
    if (waitStatus) waitStatus.innerHTML = `<span class="wait-dot"></span> Подключение к серверу...`;

    this.connectSocket(roomCode, true);
  },

  showJoinInput() {
    this.showStep("lobby-step-join");
    const input = document.getElementById("join-room-input");
    if (input) {
      input.value = "";
      input.focus();
    }
  },

  joinRoomById() {
    const input = document.getElementById("join-room-input");
    const code = input ? input.value.trim() : "";
    if (code.length === 4) {
      this.connectSocket(code, false);
    } else {
      alert("Введите 4 цифры стола!");
    }
  },

  connectSocket(roomCode, isHost) {
    try {
      this.ws = new WebSocket(`${WS_SERVER_HOST}/ws/duel/${roomCode}`);

      this.ws.onopen = () => {
        this.isNetworkMode = true;
        this.ws.send(JSON.stringify({ type: "READY", hero: this.myHero }));

        const waitStatus = document.querySelector(".duel-wait-status");
        if (waitStatus) waitStatus.innerHTML = `<span class="wait-dot"></span> Ожидание соперника...`;
      };

      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "MATCH_START") {
          this.closeLobby();
          this.enemyHero = msg.enemy;
          this.startBattle();
        } else if (msg.type === "ROUND_RESULT") {
          this.handleServerRound(msg);
        } else if (msg.type === "ERROR") {
          alert(msg.message || "Ошибка дуэли");
          this.closeLobby();
        } else if (msg.type === "OPPONENT_DISCONNECTED") {
          this.setBattleLog("СОПЕРНИК ПОКИНУЛ БОЙ");
          setTimeout(() => this.endBattle(true), 2000);
        }
      };

      this.ws.onerror = () => {
        this.showServerOfflinePrompt();
      };

      this.ws.onclose = (e) => {
        if (!this.enemyHero && e.code !== 1000) {
          this.showServerOfflinePrompt();
        }
      };
    } catch (e) {
      this.showServerOfflinePrompt();
    }
  },

  // Вместо скрытого авто-старта спрашиваем игрока:
  showServerOfflinePrompt() {
    const waitStatus = document.querySelector(".duel-wait-status");
    if (waitStatus) {
      waitStatus.innerHTML = `
        <div style="color: #f87171; margin-bottom: 8px;">Сервер Amvera не ответил</div>
        <button class="duel-secondary-btn" style="padding: 6px 12px; font-size: 11px;" onclick="NetDuel.startOfflineAiMatch()">
          Сыграть с ИИ Ботвинником
        </button>
      `;
    } else {
      if (confirm("Сетевой сервер недоступен. Запустить бой против ИИ-гроссмейстера?")) {
        this.startOfflineAiMatch();
      } else {
        this.closeLobby();
      }
    }
  },

  startOfflineAiMatch() {
    this.isNetworkMode = false;
    this.enemyHero = {
      name: "Михаил Ботвинник",
      atk: 24,
      def: 18,
      skillName: "Железная логика",
      img: "./assets/avatars/7.jpg"
    };
    this.closeLobby();
    this.startBattle();
  },

  startBattle() {
    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.display = "flex";

    this.round = 1;
    this.myHp = 100;
    this.enemyHp = 100;
    this.myEnergy = 1;
    this.enemyEnergy = 1;
    this.isShieldActive = false;
    this.enemyShieldActive = false;

    this.updateHUD();
    this.setBattleLog("ВЫБЕРИТЕ ДЕЙСТВИЕ");
  },

  updateHUD() {
    // Карточка игрока
    document.getElementById("my-hero-name").textContent = this.myHero.name;
    document.getElementById("my-avatar-img").src = this.myHero.img;
    document.getElementById("my-hp-text").textContent = `${Math.max(0, this.myHp)} / 100 HP`;
    document.getElementById("my-hp-bar").style.width = `${Math.max(0, this.myHp)}%`;
    document.getElementById("my-atk-val").textContent = this.myHero.atk;
    document.getElementById("my-def-val").textContent = this.myHero.def;
    document.getElementById("my-energy-val").textContent = `${this.myEnergy}/2`;
    document.getElementById("player-shield-fx").style.display = this.isShieldActive ? "flex" : "none";

    // Карточка оппонента
    document.getElementById("enemy-hero-name").textContent = this.enemyHero.name;
    document.getElementById("enemy-avatar-img").src = this.enemyHero.img;
    document.getElementById("enemy-hp-text").textContent = `${Math.max(0, this.enemyHp)} / 100 HP`;
    document.getElementById("enemy-hp-bar").style.width = `${Math.max(0, this.enemyHp)}%`;
    document.getElementById("enemy-atk-val").textContent = this.enemyHero.atk;
    document.getElementById("enemy-def-val").textContent = this.enemyHero.def;
    document.getElementById("enemy-energy-tracker").textContent = `${this.enemyEnergy}/2`;
    document.getElementById("enemy-skill-name").textContent = (this.enemyHero.skillName || "НАВЫК").toUpperCase();
    document.getElementById("enemy-shield-fx").style.display = this.enemyShieldActive ? "flex" : "none";

    // Ульта
    const skillBtn = document.getElementById("btn-action-spc");
    const skillBadge = document.getElementById("skill-cd-badge");
    if (skillBtn) {
      if (this.myEnergy >= 2) {
        skillBtn.classList.add("ready");
        skillBadge.textContent = "ГОТОВО ⚡";
      } else {
        skillBtn.classList.remove("ready");
        skillBadge.textContent = `${this.myEnergy}/2 ⚡`;
      }
    }

    // Раунд
    document.getElementById("round-title-badge").textContent = `РАУНД ${this.round}`;
    const evalPercent = Math.min(100, Math.max(0, 50 + (this.myHp - this.enemyHp) / 2));
    document.getElementById("duel-eval-fill").style.height = `${evalPercent}%`;
    const score = ((evalPercent - 50) / 10).toFixed(1);
    document.getElementById("duel-eval-score").textContent = score > 0 ? `+${score}` : score;
  },

  setBattleLog(text) {
    const log = document.getElementById("battle-log");
    if (log) log.textContent = text;
  },

  chooseAction(type) {
    if (type === "attack") {
      QTEFocusEngine.start();
      return;
    }

    if (type === "defend") {
      if (this.isNetworkMode) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "defend" }));
        this.setBattleLog("ЗАЩИТА ВЫБРАНА. ЖДЕМ ХОД ВРАГА...");
      } else {
        this.isShieldActive = true;
        this.myEnergy = Math.min(2, this.myEnergy + 1);
        this.triggerFlash("cyan");
        this.updateHUD();
        this.resolveAiTurn("defend", false);
      }
      return;
    }

    if (type === "skill") {
      if (this.myEnergy < 2) {
        this.setBattleLog("НЕДОСТАТОЧНО ЭНЕРГИИ ДЛЯ НАВЫКА!");
        return;
      }
      if (this.isNetworkMode) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setBattleLog("КОРОННЫЙ ХОД! ЖДЕМ ХОД ВРАГА...");
      } else {
        this.myEnergy = 0;
        this.triggerFlash("gold");
        this.updateHUD();
        this.resolveAiTurn("skill", false);
      }
    }
  },

  resolveQTE() {
    const isCrit = QTEFocusEngine.hit();
    if (this.isNetworkMode) {
      this.ws.send(JSON.stringify({ type: "MOVE", action: "attack", crit: isCrit }));
      this.setBattleLog(isCrit ? "КРИТ! ЖДЕМ ХОД СОПЕРНИКА..." : "АТАКА! ЖДЕМ ХОД СОПЕРНИКА...");
    } else {
      this.resolveAiTurn("attack", isCrit);
    }
  },

  resolveAiTurn(playerAct, isCrit) {
    const playerCard = document.getElementById("player-card-anchor");
    const enemyCard = document.getElementById("enemy-card-anchor");

    let pDmg = 0;
    if (playerAct === "attack") {
      playerCard?.classList.add("anim-lunge-up");
      pDmg = Math.round(this.myHero.atk * (isCrit ? 1.6 : 1.0));
      if (isCrit) this.triggerFlash("gold");
    } else if (playerAct === "skill") {
      playerCard?.classList.add("anim-skill-blast");
      pDmg = Math.round(this.myHero.atk * 1.8);
    }

    setTimeout(() => {
      playerCard?.classList.remove("anim-lunge-up", "anim-skill-blast");

      let oppAct = this.enemyEnergy >= 2 ? "skill" : (Math.random() > 0.35 ? "attack" : "defend");
      let eDmg = 0;

      if (oppAct === "attack") {
        enemyCard?.classList.add("anim-lunge-down");
        eDmg = this.enemyHero.atk;
        if (this.isShieldActive) eDmg = Math.max(5, eDmg - this.myHero.def);
        this.triggerFlash("red");
      } else if (oppAct === "skill") {
        enemyCard?.classList.add("anim-skill-blast");
        eDmg = Math.round(this.enemyHero.atk * 1.7);
        this.enemyEnergy = 0;
        this.triggerFlash("red");
      } else {
        this.enemyShieldActive = true;
        this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
      }

      if (this.enemyShieldActive && playerAct === "attack") {
        pDmg = Math.max(5, pDmg - this.enemyHero.def);
      }

      this.enemyHp = Math.max(0, this.enemyHp - pDmg);
      this.myHp = Math.max(0, this.myHp - eDmg);
      this.isShieldActive = false;
      this.enemyShieldActive = false;
      this.round++;

      setTimeout(() => {
        enemyCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
        this.updateHUD();
        if (this.enemyHp <= 0 || this.myHp <= 0) {
          this.endBattle(this.myHp > 0);
        } else {
          this.setBattleLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
        }
      }, 700);
    }, 600);
  },

  handleServerRound(res) {
    this.myHp = res.my_hp;
    this.enemyHp = res.enemy_hp;
    this.myEnergy = res.my_energy;
    this.enemyEnergy = res.enemy_energy;
    this.round = res.round + 1;
    this.updateHUD();

    this.setBattleLog(`УРОН: -${res.dmg_dealt} ОППОНЕНТУ | ВЫ ПОЛУЧИЛИ: -${res.dmg_taken}`);
    this.triggerFlash(res.dmg_dealt > res.dmg_taken ? "gold" : "red");

    if (this.myHp <= 0 || this.enemyHp <= 0) {
      this.endBattle(this.myHp > 0);
    }
  },

  endBattle(isWin) {
    this.setBattleLog(isWin ? "🏆 ПОБЕДА ГРОССМЕЙСТЕРА!" : "ПОРАЖЕНИЕ...");
    this.triggerFlash(isWin ? "gold" : "red");
    setTimeout(() => {
      const overlay = document.getElementById("net-battle-overlay");
      if (overlay) overlay.style.display = "none";
      if (this.ws) this.ws.close();
    }, 3000);
  },

  triggerFlash(color) {
    const flash = document.createElement("div");
    flash.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);
  }
};