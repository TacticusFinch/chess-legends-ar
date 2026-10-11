/* ================= 2. КОНТРОЛЛЕР СЕТЕВОЙ И ИИ ДУЭЛИ ================= */
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
  mySide: "white",
  isWaitingOpponent: false,

  getHero() {
    let h = window.currentHeroData;
    if (!h && typeof currentHeroId !== "undefined" && currentHeroId !== null && typeof HEROES !== "undefined") {
      h = { ...HEROES[currentHeroId], id: currentHeroId };
    }
    if (!h) {
      try {
        const cached = localStorage.getItem("last_active_hero");
        if (cached) h = JSON.parse(cached);
      } catch (e) {}
    }
    if (!h) {
      alert("Сначала наведите камеру на карту чемпиона!");
      return null;
    }

    const atk = h.stats?.find(s => s.name?.toLowerCase().includes("атак"))?.val || 75;
    const def = h.stats?.find(s => s.name?.toLowerCase().includes("защит"))?.val || 60;

    return {
      name: h.name || "Гроссмейстер",
      img: h.avatar || "./assets/avatars/steinitz.png",
      atk: Math.round(atk * 0.35),
      def: Math.round(def * 0.25),
      skillName: h.skillName || h.skill || "Коронный удар"
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
      aiBtn.style.borderColor = "var(--accent-color)";
      aiBtn.style.color = "var(--accent-color)";
      aiBtn.textContent = "🤖 Бой с Ботвинником (Одиночный)";
      aiBtn.onclick = () => NetDuel.startOfflineAiMatch();
      actionsStack.appendChild(aiBtn);
    }

    document.getElementById("duel-lobby-modal")?.classList.add("active");
    this.setStep("lobby-step-select");
  },

  closeLobby() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    document.getElementById("duel-lobby-modal")?.classList.remove("active");
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
            this.closeLobby();
            this.startBattle();
          } else if (msg.type === "ROUND_RESULT") {
            this.applyRoundResult(msg);
          } else if (msg.type === "OPPONENT_DISCONNECTED") {
            this.setLog("СОПЕРНИК ВЫШЕЛ ИЗ БОЯ");
            setTimeout(() => this.endBattle(true), 1500);
          } else if (msg.type === "ERROR") {
            alert(msg.message);
            this.closeLobby();
          }
        } catch (err) {
          console.error("Ошибка парсинга WS:", err);
        }
      };

      this.ws.onerror = () => this.askOffline();
      this.ws.onclose = () => {
        if (this.isWaitingOpponent) this.askOffline();
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

  startOfflineAiMatch() {
    this.isNet = false;
    this.mySide = "white";
    this.enemyHero = {
      name: "Михаил Ботвинник",
      atk: 22,
      def: 18,
      skillName: "Железная логика",
      img: "./assets/avatars/botvinnik.png" // Исправлено на PNG
    };
    this.closeLobby();
    this.startBattle();
  },

  startBattle() {
    document.getElementById("net-battle-overlay").style.display = "flex";
    this.round = 1;
    this.myHp = 100;
    this.enemyHp = 100;
    this.myEnergy = 1;
    this.enemyEnergy = 1;
    this.myShield = false;
    this.enemyShield = false;
    this.isWaitingOpponent = false;

    // Стороны фигур (Белые / Черные)
    const mySideBadge = document.querySelector(".player-panel .actor-side-badge");
    const enemySideBadge = document.querySelector(".enemy-panel .actor-side-badge");
    if (mySideBadge && enemySideBadge) {
      if (this.mySide === "black") {
        mySideBadge.className = "actor-side-badge side-black";
        mySideBadge.textContent = "ЧЁРНЫЕ";
        enemySideBadge.className = "actor-side-badge side-white";
        enemySideBadge.textContent = "БЕЛЫЕ";
      } else {
        mySideBadge.className = "actor-side-badge side-white";
        mySideBadge.textContent = "БЕЛЫЕ";
        enemySideBadge.className = "actor-side-badge side-black";
        enemySideBadge.textContent = "ЧЁРНЫЕ";
      }
    }

    this.lockActions(false);
    this.updateHUD();
    this.setLog("ВЫБЕРИТЕ ДЕЙСТВИЕ");
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

    // Игрок
    set("my-hero-name", this.myHero.name);
    const myImg = document.getElementById("my-avatar-img");
    if (myImg) myImg.src = this.myHero.img;
    set("my-hp-text", `${Math.max(0, this.myHp)} / 100 HP`);
    document.getElementById("my-hp-bar").style.width = `${Math.max(0, this.myHp)}%`;
    set("my-atk-val", this.myHero.atk);
    set("my-def-val", this.myHero.def);
    set("my-energy-val", `${this.myEnergy}/2`);
    document.getElementById("player-shield-fx").style.display = this.myShield ? "flex" : "none";

    // Соперник
    set("enemy-hero-name", this.enemyHero.name);
    const enemyImg = document.getElementById("enemy-avatar-img");
    if (enemyImg) enemyImg.src = this.enemyHero.img;
    set("enemy-hp-text", `${Math.max(0, this.enemyHp)} / 100 HP`);
    document.getElementById("enemy-hp-bar").style.width = `${Math.max(0, this.enemyHp)}%`;
    set("enemy-atk-val", this.enemyHero.atk);
    set("enemy-def-val", this.enemyHero.def);
    set("enemy-energy-tracker", `${this.enemyEnergy}/2`);
    set("enemy-skill-name", (this.enemyHero.skillName || "НАВЫК").toUpperCase());
    document.getElementById("enemy-shield-fx").style.display = this.enemyShield ? "flex" : "none";

    // Кнопка коронного приема
    const spcBtn = document.getElementById("btn-action-spc");
    if (spcBtn) {
      spcBtn.classList.toggle("ready", this.myEnergy >= 2);
      set("skill-cd-badge", this.myEnergy >= 2 ? "ГОТОВО ⚡" : `${this.myEnergy}/2 ⚡`);
    }

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

  chooseAction(type) {
    if (this.isWaitingOpponent) return;

    if (type === "attack") {
      QTEFocusEngine.start();
      return;
    }
    if (type === "defend") {
      this.lockActions(true);
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
      if (this.isNet) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setLog("КОРОННЫЙ ХОД! ЖДЕМ ХОД...");
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
    this.lockActions(true);

    if (this.isNet) {
      this.ws.send(JSON.stringify({ type: "MOVE", action: "attack", crit: isCrit }));
      this.setLog(isCrit ? "🔥 КРИТ! ЖДЕМ ХОД..." : "⚔️ АТАКА! ЖДЕМ ХОД...");
    } else {
      this.runAiTurn("attack", isCrit);
    }
  },

  applyRoundResult(res) {
    const pCard = document.getElementById("player-card-anchor");
    const eCard = document.getElementById("enemy-card-anchor");

    // Показываем, что сделал соперник
    this.enemyShield = (res.enemy_action === "defend");
    if (res.enemy_action === "attack") eCard?.classList.add("anim-lunge-down");
    if (res.enemy_action === "skill") eCard?.classList.add("anim-skill-blast");

    this.updateHUD();

    setTimeout(() => {
      eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
      
      this.myHp = res.my_hp;
      this.enemyHp = res.enemy_hp;
      this.myEnergy = res.my_energy;
      this.enemyEnergy = res.enemy_energy;
      this.round = res.round; // Раунд синхронизируем с сервером без +1!
      this.myShield = false;
      this.enemyShield = false;

      this.updateHUD();
      this.setLog(`УРОН: -${res.dmg_dealt} | ПОЛУЧЕНО: -${res.dmg_taken}`);
      this.fx(res.dmg_dealt >= res.dmg_taken ? "gold" : "red");

      setTimeout(() => {
        if (this.myHp <= 0 || this.enemyHp <= 0) {
          this.endBattle(this.myHp > 0);
        } else {
          this.lockActions(false);
          this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
        }
      }, 900);
    }, 600);
  },

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

      if (this.enemyShield && playerAct === "attack") {
        pDmg = Math.max(5, pDmg - this.enemyHero.def);
      }

      this.enemyHp = Math.max(0, this.enemyHp - pDmg);
      this.myHp = Math.max(0, this.myHp - eDmg);
      this.round++;

      setTimeout(() => {
        eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
        this.myShield = false;
        this.enemyShield = false;
        this.updateHUD();

        if (this.enemyHp <= 0 || this.myHp <= 0) {
          this.endBattle(this.myHp > 0);
        } else {
          this.lockActions(false);
          this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
        }
      }, 700);
    }, 500);
  },

  endBattle(isWin) {
    this.setLog(isWin ? "🏆 ПОБЕДА ГРОССМЕЙСТЕРА!" : "ПОРАЖЕНИЕ...");
    this.fx(isWin ? "gold" : "red");
    if (typeof sfx !== "undefined") {
      if (isWin && sfx.playFanfare) sfx.playFanfare();
      else if (!isWin && sfx.playWrong) sfx.playWrong();
    }
    setTimeout(() => {
      document.getElementById("net-battle-overlay").style.display = "none";
      if (this.ws) {
        try { this.ws.close(); } catch (e) {}
        this.ws = null;
      }
      this.lockActions(false);
    }, 2800);
  },

  fx(color) {
    const div = document.createElement("div");
    div.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 400);
  }
};