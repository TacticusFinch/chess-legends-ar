/**
 * Тактикус Финч — Модуль Сетевой Дуэли (Amvera Cloud Edition)
 */
const AMVERA_WS = "wss://chesslegendsai-tacticusfinch.mia0.amvera.tech";

/* ================= 1. МИНИ-ДВИЖОК QTE «ФОКУС» ================= */
const QTEFocusEngine = {
  cursor: null,
  trackWidth: 260,
  pos: 0,
  dir: 1,
  raf: null,
  active: false,

  start() {
    const modal = document.getElementById("qte-focus-modal");
    this.cursor = document.getElementById("qte-cursor");
    if (!modal || !this.cursor) return;

    modal.style.display = "flex";
    this.pos = 0;
    this.dir = 1;
    this.active = true;

    const tick = () => {
      if (!this.active) return;
      this.pos += 4.5 * this.dir;
      if (this.pos >= this.trackWidth - 14) this.dir = -1;
      if (this.pos <= 0) this.dir = 1;
      this.cursor.style.transform = `translateX(${this.pos}px)`;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  },

  hit() {
    if (!this.active) return false;
    this.active = false;
    cancelAnimationFrame(this.raf);
    // Крит при попадании в зону 110px..150px (центр 130px)
    const isCrit = Math.abs(this.pos + 7 - 130) <= 20;
    setTimeout(() => {
      const modal = document.getElementById("qte-focus-modal");
      if (modal) modal.style.display = "none";
    }, 300);
    return isCrit;
  }
};

/* ================= 2. ОСНОВНОЙ КОНТРОЛЛЕР ДУЭЛИ ================= */
window.NetDuel = {
  ws: null,
  isNet: false,
  round: 1,
  myHp: 100,
  enemyHp: 100,
  myEnergy: 1,
  enemyEnergy: 1,
  myShield: false,
  enemyShield: false,
  myHero: null,
  enemyHero: null,

  // Привязка выбранной карточки из AR
  getHero() {
    const h = window.currentHeroData;
    if (!h) {
      alert("Сначала наведите камеру на карту чемпиона!");
      return null;
    }
    const atk = h.stats?.find(s => s.name?.toLowerCase().includes("атак"))?.val || 75;
    const def = h.stats?.find(s => s.name?.toLowerCase().includes("защит"))?.val || 60;

    return {
      name: h.name || "Гроссмейстер",
      img: h.avatar || (h.id !== undefined ? `./assets/avatars/${h.id}.jpg` : "./assets/avatars/0.jpg"),
      atk: Math.round(atk * 0.35),
      def: Math.round(def * 0.25),
      skillName: h.skill || "Коронный удар"
    };
  },

  // Управление лобби
  openLobby() {
    this.myHero = this.getHero();
    if (!this.myHero) return;
    document.getElementById("duel-lobby-modal")?.classList.add("active");
    this.setStep("lobby-step-select");
  },

  closeLobby() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    document.getElementById("duel-lobby-modal")?.classList.remove("active");
  },

  setStep(stepId) {
    ["lobby-step-select", "lobby-step-host", "lobby-step-join"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === stepId) ? "block" : "none";
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

  // Сетевое подключение
  connect(code) {
    try {
      this.ws = new WebSocket(`${AMVERA_WS}/ws/duel/${code}`);
      
      this.ws.onopen = () => {
        this.isNet = true;
        this.ws.send(JSON.stringify({ type: "READY", hero: this.myHero }));
      };

      this.ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "MATCH_START") {
          this.enemyHero = msg.enemy;
          this.closeLobby();
          this.startBattle();
        } else if (msg.type === "ROUND_RESULT") {
          this.applyRoundResult(msg);
        } else if (msg.type === "OPPONENT_DISCONNECTED") {
          this.setLog("СОПЕРНИК ВЫШЕЛ");
          setTimeout(() => this.endBattle(true), 1500);
        }
      };

      this.ws.onerror = () => this.askOffline();
    } catch {
      this.askOffline();
    }
  },

  askOffline() {
    if (confirm("Сервер Amvera не отвечает. Сыграть тренировку с ботом?")) {
      this.isNet = false;
      this.enemyHero = { name: "Ботвинник", atk: 24, def: 18, skillName: "Железная логика", img: "./assets/avatars/7.jpg" };
      this.closeLobby();
      this.startBattle();
    } else {
      this.closeLobby();
    }
  },

  // Старт и обновление боя
  startBattle() {
    document.getElementById("net-battle-overlay").style.display = "flex";
    this.round = 1;
    this.myHp = 100;
    this.enemyHp = 100;
    this.myEnergy = 1;
    this.enemyEnergy = 1;
    this.myShield = false;
    this.enemyShield = false;
    this.updateHUD();
    this.setLog("ВЫБЕРИТЕ ДЕЙСТВИЕ");
  },

  updateHUD() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    
    // Игрок
    set("my-hero-name", this.myHero.name);
    document.getElementById("my-avatar-img").src = this.myHero.img;
    set("my-hp-text", `${Math.max(0, this.myHp)} / 100 HP`);
    document.getElementById("my-hp-bar").style.width = `${Math.max(0, this.myHp)}%`;
    set("my-atk-val", this.myHero.atk);
    set("my-def-val", this.myHero.def);
    set("my-energy-val", `${this.myEnergy}/2`);
    document.getElementById("player-shield-fx").style.display = this.myShield ? "flex" : "none";

    // Соперник
    set("enemy-hero-name", this.enemyHero.name);
    document.getElementById("enemy-avatar-img").src = this.enemyHero.img;
    set("enemy-hp-text", `${Math.max(0, this.enemyHp)} / 100 HP`);
    document.getElementById("enemy-hp-bar").style.width = `${Math.max(0, this.enemyHp)}%`;
    set("enemy-atk-val", this.enemyHero.atk);
    set("enemy-def-val", this.enemyHero.def);
    set("enemy-energy-tracker", `${this.enemyEnergy}/2`);
    set("enemy-skill-name", (this.enemyHero.skillName || "НАВЫК").toUpperCase());
    document.getElementById("enemy-shield-fx").style.display = this.enemyShield ? "flex" : "none";

    // Кнопка ульты
    const spcBtn = document.getElementById("btn-action-spc");
    if (spcBtn) {
      spcBtn.classList.toggle("ready", this.myEnergy >= 2);
      set("skill-cd-badge", this.myEnergy >= 2 ? "ГОТОВО ⚡" : `${this.myEnergy}/2 ⚡`);
    }

    // Раунд и шкала преимущества
    set("round-title-badge", `РАУНД ${this.round}`);
    const evalScore = Math.min(100, Math.max(0, 50 + (this.myHp - this.enemyHp) / 2));
    document.getElementById("duel-eval-fill").style.height = `${evalScore}%`;
    const scoreVal = ((evalScore - 50) / 10).toFixed(1);
    set("duel-eval-score", scoreVal > 0 ? `+${scoreVal}` : scoreVal);
  },

  setLog(text) {
    const el = document.getElementById("battle-log");
    if (el) el.textContent = text;
  },

  // Выбор действия
  chooseAction(type) {
    if (type === "attack") {
      QTEFocusEngine.start();
      return;
    }
    if (type === "defend") {
      if (this.isNet) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "defend" }));
        this.setLog("ЗАЩИТА... ЖДЕМ ХОД ВРАГА");
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
      if (this.myEnergy < 2) return this.setLog("НУЖНО 2⚡ ЭНЕРГИИ!");
      if (this.isNet) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setLog("КОРОННЫЙ ХОД! ЖДЕМ ХОД ВРАГА");
      } else {
        this.myEnergy = 0;
        this.fx("gold");
        this.updateHUD();
        this.runAiTurn("skill", false);
      }
    }
  },

  resolveQTE() {
    const isCrit = QTEFocusEngine.hit();
    if (this.isNet) {
      this.ws.send(JSON.stringify({ type: "MOVE", action: "attack", crit: isCrit }));
      this.setLog(isCrit ? "КРИТИЧЕСКИЙ ФОКУС!" : "АТАКА! ЖДЕМ ХОД...");
    } else {
      this.runAiTurn("attack", isCrit);
    }
  },

  // Офлайн-бой (если сеть отключена)
  runAiTurn(playerAct, isCrit) {
    const pCard = document.getElementById("player-card-anchor");
    const eCard = document.getElementById("enemy-card-anchor");

    let pDmg = 0;
    if (playerAct === "attack") {
      pCard?.classList.add("anim-lunge-up");
      pDmg = Math.round(this.myHero.atk * (isCrit ? 1.6 : 1.0));
      if (isCrit) this.fx("gold");
    } else if (playerAct === "skill") {
      pCard?.classList.add("anim-skill-blast");
      pDmg = Math.round(this.myHero.atk * 1.8);
    }

    setTimeout(() => {
      pCard?.classList.remove("anim-lunge-up", "anim-skill-blast");
      
      const oppAct = this.enemyEnergy >= 2 ? "skill" : (Math.random() > 0.4 ? "attack" : "defend");
      let eDmg = 0;

      if (oppAct === "attack") {
        eCard?.classList.add("anim-lunge-down");
        eDmg = this.myShield ? Math.max(5, this.enemyHero.atk - this.myHero.def) : this.enemyHero.atk;
        this.fx("red");
      } else if (oppAct === "skill") {
        eCard?.classList.add("anim-skill-blast");
        eDmg = Math.round(this.enemyHero.atk * 1.7);
        this.enemyEnergy = 0;
        this.fx("red");
      } else {
        this.enemyShield = true;
        this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
      }

      if (this.enemyShield && playerAct === "attack") pDmg = Math.max(5, pDmg - this.enemyHero.def);

      this.enemyHp = Math.max(0, this.enemyHp - pDmg);
      this.myHp = Math.max(0, this.myHp - eDmg);
      this.myShield = false;
      this.enemyShield = false;
      this.round++;

      setTimeout(() => {
        eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
        this.updateHUD();
        if (this.enemyHp <= 0 || this.myHp <= 0) this.endBattle(this.myHp > 0);
        else this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
      }, 600);
    }, 500);
  },

  // Прием сетевого раунда
  applyRoundResult(res) {
    this.myHp = res.my_hp;
    this.enemyHp = res.enemy_hp;
    this.myEnergy = res.my_energy;
    this.enemyEnergy = res.enemy_energy;
    this.round = res.round + 1;
    this.updateHUD();
    this.setLog(`УРОН: -${res.dmg_dealt} | ПОЛУЧЕНО: -${res.dmg_taken}`);
    this.fx(res.dmg_dealt >= res.dmg_taken ? "gold" : "red");

    if (this.myHp <= 0 || this.enemyHp <= 0) this.endBattle(this.myHp > 0);
  },

  endBattle(isWin) {
    this.setLog(isWin ? "🏆 ПОБЕДА ГРОССМЕЙСТЕРА!" : "ПОРАЖЕНИЕ...");
    this.fx(isWin ? "gold" : "red");
    setTimeout(() => {
      document.getElementById("net-battle-overlay").style.display = "none";
      if (this.ws) this.ws.close();
    }, 2800);
  },

  fx(color) {
    const div = document.createElement("div");
    div.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 400);
  }
};