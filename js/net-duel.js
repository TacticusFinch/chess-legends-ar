/**
 * Тактикус Финч — Модуль Сетевой Дуэли и QTE-Фокуса
 */

// Укажите адрес вашего сервера на Amvera (замените https:// на wss://)
const WS_SERVER_HOST = window.location.hostname === "localhost" 
  ? "ws://localhost:8000" 
  : "wss://" + window.location.host;

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
    this.speed = 5;
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

    // Центр трека 130px. Зона крита: 105px - 145px
    const center = this.trackWidth / 2;
    const isCrit = Math.abs(this.pos + 7 - center) <= 22;

    const modal = document.getElementById("qte-focus-modal");
    setTimeout(() => {
      if (modal) modal.style.display = "none";
    }, 400);

    return isCrit;
  }
};

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

  myHero: { name: "Хосе Капабланка", atk: 25, def: 15, skillName: "Точный расчет", img: "./assets/avatars/2.jpg" },
  enemyHero: { name: "Михаил Ботвинник", atk: 22, def: 18, skillName: "Железная логика", img: "./assets/avatars/7.jpg" },

  // Выбор героя: берется распознанная AR-карточка
  detectCurrentHero() {
    if (window.currentHeroData) {
      this.myHero.name = window.currentHeroData.name || "Гроссмейстер";
      this.myHero.img = window.currentHeroData.avatar || `./assets/avatars/${window.currentHeroData.id}.jpg`;
      
      const atkObj = window.currentHeroData.stats?.find(s => s.name.toLowerCase().includes("атака"));
      const defObj = window.currentHeroData.stats?.find(s => s.name.toLowerCase().includes("защита"));
      this.myHero.atk = atkObj ? Math.round(atkObj.val * 0.32) : 25;
      this.myHero.def = defObj ? Math.round(defObj.val * 0.25) : 15;
      this.myHero.skillName = window.currentHeroData.skill || "Коронный удар";
    }
  },

  openLobby() {
    this.detectCurrentHero();
    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.add("active");
    this.showStep("lobby-step-select");
  },

  closeLobby() {
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

    this.connectSocket(roomCode);
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
    if (input && input.value.length === 4) {
      this.connectSocket(input.value);
    } else {
      alert("Введите 4 цифры стола!");
    }
  },

  connectSocket(roomCode) {
    try {
      this.ws = new WebSocket(`${WS_SERVER_HOST}/ws/duel/${roomCode}`);
      this.ws.onopen = () => {
        this.isNetworkMode = true;
        this.ws.send(json({ type: "READY", hero: this.myHero }));
      };
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "MATCH_START") {
          this.closeLobby();
          this.enemyHero = msg.enemy;
          this.startBattle();
        } else if (msg.type === "ROUND_RESULT") {
          this.handleServerRound(msg);
        } else if (msg.type === "OPPONENT_DISCONNECTED") {
          this.setBattleLog("СОПЕРНИК ВЫШЕЛ ИЗ БОЯ");
          setTimeout(() => this.endBattle(true), 1500);
        }
      };
      this.ws.onerror = () => this.fallbackToAi();
    } catch (e) {
      this.fallbackToAi();
    }
  },

  fallbackToAi() {
    this.isNetworkMode = false;
    setTimeout(() => {
      this.closeLobby();
      this.startBattle();
    }, 1000);
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
    // Игрок
    document.getElementById("my-hero-name").textContent = this.myHero.name;
    document.getElementById("my-avatar-img").src = this.myHero.img;
    document.getElementById("my-hp-text").textContent = `${this.myHp} / 100 HP`;
    document.getElementById("my-hp-bar").style.width = `${this.myHp}%`;
    document.getElementById("my-atk-val").textContent = this.myHero.atk;
    document.getElementById("my-def-val").textContent = this.myHero.def;
    document.getElementById("my-energy-val").textContent = `${this.myEnergy}/2`;
    document.getElementById("player-shield-fx").style.display = this.isShieldActive ? "flex" : "none";

    // Соперник
    document.getElementById("enemy-hero-name").textContent = this.enemyHero.name;
    document.getElementById("enemy-avatar-img").src = this.enemyHero.img;
    document.getElementById("enemy-hp-text").textContent = `${this.enemyHp} / 100 HP`;
    document.getElementById("enemy-hp-bar").style.width = `${this.enemyHp}%`;
    document.getElementById("enemy-atk-val").textContent = this.enemyHero.atk;
    document.getElementById("enemy-def-val").textContent = this.enemyHero.def;
    document.getElementById("enemy-energy-tracker").textContent = `${this.enemyEnergy}/2`;
    document.getElementById("enemy-skill-name").textContent = (this.enemyHero.skillName || "НАВЫК").toUpperCase();
    document.getElementById("enemy-shield-fx").style.display = this.enemyShieldActive ? "flex" : "none";

    // Кнопка ульты
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

    // Раунд и шкала преимущества
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
        this.setBattleLog("ОЖИДАНИЕ ХОДА СОПЕРНИКА...");
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
        this.setBattleLog("НЕДОСТАТОЧНО ЭНЕРГИИ!");
        return;
      }
      if (this.isNetworkMode) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setBattleLog("ОЖИДАНИЕ ХОДА СОПЕРНИКА...");
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
      this.setBattleLog(isCrit ? "КРИТИЧЕСКИЙ ФОКУС! ЖДЕМ ХОД..." : "АТАКА! ЖДЕМ ХОД...");
    } else {
      this.resolveAiTurn("attack", isCrit);
    }
  },

  // Локальный ИИ (если дуэль без интернета)
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
      
      // Ход ИИ
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