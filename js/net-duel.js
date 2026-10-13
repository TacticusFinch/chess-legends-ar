/**
 * Тактикус Финч — Модуль Дуэлей на WebSocket Amvera
 * Кинематографичные аркадные эффекты (Floating Dmg, Screen Shake, Super Cut-in, Haptics)
 */
const AMVERA_WS = "wss://chesslegendsai-tacticusfinch.mia0.amvera.tech";

/* ================= 1. ДВИЖОК ТАКТИЧЕСКОЙ ДОСКИ (ТАПАМИ) ================= */
const InteractiveBoardEngine = {
  board: null,
  game: null,
  currentPuzzle: null,
  active: false,
  selectedSquare: null,

  start() {
    const modal = document.getElementById("tactical-board-modal");
    const descEl = document.getElementById("tactical-task-title");
    const skillTooltip = document.getElementById("battle-skill-tooltip");

    // Прячем подсказку скилла на время решения задачи
    if (skillTooltip) skillTooltip.style.display = "none";

    if (!modal) return;

    modal.style.display = "flex";
    this.active = true;
    this.selectedSquare = null;

    this.currentPuzzle = (typeof getRandomDuelPuzzle === "function")
      ? getRandomDuelPuzzle()
      : {
          fen: "6k1/5ppp/8/8/8/8/8/1R4K1 w - - 0 1",
          move: { from: "b1", to: "b8" },
          desc: "Найдите лучший ход"
        };

    this.game = new Chess(this.currentPuzzle.fen);

    if (descEl) descEl.textContent = "Найдите лучший ход";

    setTimeout(() => {
      this.initBoard();
    }, 60);
  },

  initBoard() {
    const config = {
      draggable: false,
      position: this.currentPuzzle.fen,
      orientation: this.game.turn() === 'w' ? 'white' : 'black',
      pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
    };

    if (this.board) {
      this.board.destroy();
    }
    this.board = Chessboard('strike-board', config);
    this.bindSquareClicks();
  },

  removeHighlights() {
    $('#strike-board .square-55d63').removeClass('highlight-selected highlight-dest highlight-dest-capture');
  },

  bindSquareClicks() {
    const self = this;
    const boardEl = $('#strike-board');

    boardEl.off('click touchstart', '.square-55d63');

    boardEl.on('click touchstart', '.square-55d63', function(e) {
      if (!self.active) return;
      e.preventDefault();

      const square = $(this).attr('data-square');
      if (!square) return;

      const pieceOnSquare = self.game.get(square);
      const isMyPiece = pieceOnSquare && pieceOnSquare.color === self.game.turn();

      if (isMyPiece) {
        self.selectedSquare = square;
        self.removeHighlights();
        $(this).addClass('highlight-selected');

        const moves = self.game.moves({ square: square, verbose: true });
        moves.forEach(m => {
          const isCapture = !!self.game.get(m.to);
          const targetEl = $(`#strike-board .square-${m.to}`);
          if (isCapture) {
            targetEl.addClass('highlight-dest-capture');
          } else {
            targetEl.addClass('highlight-dest');
          }
        });

        if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
        return;
      }

      if (self.selectedSquare) {
        const source = self.selectedSquare;
        const target = square;
        const targetMove = self.currentPuzzle.move;

        self.active = false;
        self.removeHighlights();

        const isCorrect = (source === targetMove.from && target === targetMove.to);

        if (isCorrect) {
          self.game.move({ from: source, to: target });
          self.board.position(self.game.fen());
          self.onSuccess();
        } else {
          self.game.move({ from: source, to: target });
          self.board.position(self.game.fen());
          self.onError(source);
        }
      }
    });
  },

  onSuccess() {
    if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();

    setTimeout(() => {
      const modal = document.getElementById("tactical-board-modal");
      if (modal) modal.style.display = "none";

      // Возвращаем подсказку скилла
      const skillTooltip = document.getElementById("battle-skill-tooltip");
      if (skillTooltip) skillTooltip.style.display = "flex";

      NetDuel.resolveTacticalStrike(true);
    }, 450);
  },

  onError(originalSquare) {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();

    setTimeout(() => {
      if (this.board) this.board.position(this.currentPuzzle.fen);
    }, 300);

    setTimeout(() => {
      const modal = document.getElementById("tactical-board-modal");
      if (modal) modal.style.display = "none";

      // Возвращаем подсказку скилла
      const skillTooltip = document.getElementById("battle-skill-tooltip");
      if (skillTooltip) skillTooltip.style.display = "flex";

      NetDuel.resolveTacticalStrike(false);
    }, 550);
  }
};

/* ================= 2. КОНТРОЛЛЕР СЕТЕВОЙ И ИИ ДУЭЛИ ================= */
window.NetDuel = {
  ws: null,
  isNet: false,
  round: 1,
  maxHp: 50,
  myHp: 50,
  enemyHp: 50,
  myEnergy: 1,
  enemyEnergy: 1,
  myShield: false,
  enemyShield: false,
  myHero: null,
  enemyHero: null,
  mySide: "white",
  isWaitingOpponent: false,

  // ================= АРКАДНЫЕ ВАУ-ЭФФЕКТЫ =================
  vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  },

  screenShake(heavy = false) {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;
    const cls = heavy ? "screen-shake-heavy" : "screen-shake-light";
    overlay.classList.remove("screen-shake-light", "screen-shake-heavy");
    void overlay.offsetWidth; // Force Reflow
    overlay.classList.add(cls);
    setTimeout(() => overlay.classList.remove(cls), 450);
  },

  spawnDamageNumber(anchorId, amount, isCrit = false) {
    const anchor = document.getElementById(anchorId);
    const overlay = document.getElementById("net-battle-overlay");
    if (!anchor || !overlay || amount <= 0) return;

    // Вычисляем точные экранные координаты центра аватара
    const rect = anchor.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();

    const posX = rect.left + rect.width / 2 - overlayRect.left;
    const posY = rect.top + rect.height / 2 - overlayRect.top;

    const el = document.createElement("div");
    el.className = `floating-dmg-num ${isCrit ? "crit" : ""}`;
    el.textContent = isCrit ? `КРИТ -${amount}` : `-${amount}`;

    // Позиционируем прямо над центром персонажа
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;

    overlay.appendChild(el);

    // Удаляем после завершения долгой анимации зависания (1.8 сек)
    setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 1800);
  },

  showSuperCutIn(hero, skillName) {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;

    const cutin = document.createElement("div");
    cutin.className = "super-cutin-overlay";
    cutin.innerHTML = `
      <div class="super-cutin-banner">
        <img class="cutin-avatar" src="${hero.img}" alt="${hero.name}">
        <div class="cutin-text-group">
          <span class="cutin-hero-name">${hero.name}</span>
          <span class="cutin-skill-name">«${skillName || "КОРОННЫЙ ХОД"}»</span>
        </div>
      </div>
    `;

    overlay.appendChild(cutin);
    this.screenShake(true);
    this.vibrate([60, 40, 90]);
    setTimeout(() => cutin.remove(), 2400); // Увеличенная задержка суперудара
  },

  getHero() {
    let h = window.currentHeroData;

    if (!h && typeof currentHeroId !== "undefined" && currentHeroId !== null && typeof HEROES !== "undefined") {
      h = { ...HEROES[currentHeroId], id: currentHeroId };
    }

    if (!h) {
      alert("Сначала наведите камеру на карту чемпиона!");
      return null;
    }

    const heroCardData = (typeof HERO_STATS_DATA !== "undefined" && HERO_STATS_DATA[h.id]) 
      ? HERO_STATS_DATA[h.id] 
      : { atk: 7, def: 7, rank: "legend", skillName: "Коронный ход", skillId: "DEFAULT" };
      
    const rankInfo = (typeof HERO_RANKS !== "undefined" && HERO_RANKS[heroCardData.rank]) 
      ? HERO_RANKS[heroCardData.rank] 
      : { name: "ЛЕГЕНДА", color: "#e2b868" };

    return {
      id: h.id !== undefined ? h.id : 0,
      name: h.name || "Гроссмейстер",
      img: h.avatar || "./assets/avatars/steinitz.png",
      atk: heroCardData.atk,
      def: heroCardData.def,
      rank: rankInfo.name,
      rankKey: heroCardData.rank,
      rankColor: rankInfo.color,
      skillName: heroCardData.skillName,
      skillId: heroCardData.skillId
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
      aiBtn.style.borderColor = "var(--accent-gold)";
      aiBtn.style.color = "var(--accent-gold)";
      aiBtn.textContent = "Бой с Ботвинником (Одиночный)";
      aiBtn.onclick = () => NetDuel.startOfflineAiMatch();
      actionsStack.appendChild(aiBtn);
    }

    document.getElementById("duel-lobby-modal")?.classList.add("active");
    this.setStep("lobby-step-select");
  },

  hideLobbyModal() {
    document.getElementById("duel-lobby-modal")?.classList.remove("active");
  },

  closeLobby() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.hideLobbyModal();
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
            this.hideLobbyModal();
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

      this.ws.onerror = () => {
        if (!this.isNet) this.askOffline();
      };
      
      this.ws.onclose = () => {
        if (!this.isNet) this.askOffline();
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
    const bData = (typeof HERO_STATS_DATA !== "undefined" && HERO_STATS_DATA[7]) 
      ? HERO_STATS_DATA[7] 
      : { atk: 6, def: 8, rank: "legend", skillName: "Архитектор мысли", skillId: "BOTVINNIK_ARCHITECT" };

    this.enemyHero = {
      id: 7,
      name: "Михаил Ботвинник",
      atk: bData.atk,
      def: bData.def,
      rank: "ЛЕГЕНДА",
      rankKey: "legend",
      rankColor: "#e2b868",
      skillName: bData.skillName,
      skillId: bData.skillId,
      img: "./assets/avatars/botvinnik.png"
    };
    this.hideLobbyModal();
    this.startBattle();
  },

startBattle() {
    if (typeof stopAllTargetVideosImmediate === "function") {
      stopAllTargetVideosImmediate();
    }

    document.getElementById("net-battle-overlay").style.display = "flex";
    document.getElementById("duel-victory-modal")?.classList.remove("active");

    this.round = 1;
    this.myHp = 50;
    this.enemyHp = 50;
    this.myEnergy = 1;
    this.enemyEnergy = 1;
    this.myShield = false;
    this.enemyShield = false;
    this.isWaitingOpponent = false;

    if (typeof sfx !== "undefined" && sfx.playBattleStart) {
      sfx.playBattleStart();
    }
    this.vibrate(60);

    this.lockActions(false);
    this.updateHUD();
    this.setLog("БИТВА НАЧАЛАСЬ! ВЫБЕРИТЕ ХОД");
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

    // 1. Игрок
    set("my-hero-name", this.myHero.name);
    const myImg = document.getElementById("my-avatar-img");
    if (myImg) myImg.src = this.myHero.img;

    const currentMyHp = Math.max(0, this.myHp);
    set("my-hp-text", `${currentMyHp} / 35`);
    const myHpPercent = Math.round((currentMyHp / 35) * 100);
    document.getElementById("my-hp-bar").style.width = `${myHpPercent}%`;
    const myGhost = document.getElementById("my-hp-ghost");
    if (myGhost) myGhost.style.width = `${myHpPercent}%`;

    set("my-atk-val", this.myHero.atk);
    set("my-def-val", this.myHero.def);
    set("my-energy-val", `${this.myEnergy}/2`);
    document.getElementById("player-shield-fx").style.display = this.myShield ? "flex" : "none";

    const pRankBadge = document.querySelector(".player-panel .actor-side-badge");
    if (pRankBadge && this.myHero.rank) {
      pRankBadge.textContent = this.myHero.rank;
      pRankBadge.className = `actor-side-badge rank-${(this.myHero.rankKey || 'legend').toLowerCase()}`;
    }

    // 2. Оппонент
    set("enemy-hero-name", this.enemyHero.name);
    const enemyImg = document.getElementById("enemy-avatar-img");
    if (enemyImg) enemyImg.src = this.enemyHero.img;

    const currentEnemyHp = Math.max(0, this.enemyHp);
    set("enemy-hp-text", `${currentEnemyHp} / 35`);
    const enemyHpPercent = Math.round((currentEnemyHp / 35) * 100);
    document.getElementById("enemy-hp-bar").style.width = `${enemyHpPercent}%`;
    const enemyGhost = document.getElementById("enemy-hp-ghost");
    if (enemyGhost) enemyGhost.style.width = `${enemyHpPercent}%`;

    set("enemy-atk-val", this.enemyHero.atk);
    set("enemy-def-val", this.enemyHero.def);
    set("enemy-energy-tracker", `${this.enemyEnergy}/2`);
    document.getElementById("enemy-shield-fx").style.display = this.enemyShield ? "flex" : "none";

    const eRankBadge = document.querySelector(".enemy-panel .actor-side-badge");
    if (eRankBadge && this.enemyHero.rank) {
      eRankBadge.textContent = this.enemyHero.rank;
      eRankBadge.className = `actor-side-badge rank-${(this.enemyHero.rankKey || 'legend').toLowerCase()}`;
    }

    // 3. Диоды энергии кнопки скилла
    const spcBtn = document.getElementById("btn-action-spc");
    const led1 = document.getElementById("spc-led-1");
    const led2 = document.getElementById("spc-led-2");
    if (led1) led1.classList.toggle("on", this.myEnergy >= 1);
    if (led2) led2.classList.toggle("on", this.myEnergy >= 2);
    if (spcBtn) spcBtn.classList.toggle("ready", this.myEnergy >= 2);

    // 4. Оценка и раунд
    set("round-title-badge", `РАУНД ${this.round}`);
    const evalScore = Math.min(100, Math.max(0, 50 + (this.myHp - this.enemyHp) / 2));
    document.getElementById("duel-eval-fill").style.height = `${evalScore}%`;
    const scoreVal = ((evalScore - 50) / 10).toFixed(1);
    set("duel-eval-score", scoreVal > 0 ? `+${scoreVal}` : scoreVal);

    // 5. Подсказка уникального супернавыка в центре экрана
    const skillTipEl = document.getElementById("tooltip-skill-desc");
    const skillNameEl = document.getElementById("tooltip-skill-name");

    if (this.myHero) {
      if (skillNameEl) {
        skillNameEl.textContent = (this.myHero.skillName || "НАВЫК").toUpperCase();
      }
      if (skillTipEl) {
        const heroData = (typeof HERO_STATS_DATA !== "undefined") ? HERO_STATS_DATA[this.myHero.id] : null;
        skillTipEl.textContent = (heroData && heroData.tip) 
          ? heroData.tip 
          : "Накопите 2 единицы энергии для сокрушительного удара";
      }
    }
  },

  setLog(text) {
    const el = document.getElementById("battle-log");
    if (el) el.textContent = text;
  },

chooseAction(type) {
    if (this.isWaitingOpponent) return;

    if (type === "attack") {
      InteractiveBoardEngine.start();
      return;
    }
    if (type === "defend") {
      this.lockActions(true);
      if (typeof sfx !== "undefined" && sfx.playShield) sfx.playShield();
      this.vibrate(35);

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

      // ВАУ-ЭФФЕКТ: Кинематографичный Super Cut-in баннер
      this.showSuperCutIn(this.myHero, this.myHero.skillName);

      if (typeof sfx !== "undefined" && sfx.playUltimate) sfx.playUltimate();

      if (this.isNet) {
        this.ws.send(JSON.stringify({ type: "MOVE", action: "skill" }));
        this.setLog("КОРОННЫЙ ХОД! ЖДЕМ ХОД...");
      } else {
        this.runAiTurn("skill", false);
      }
    }
  },

  resolveTacticalStrike(isCrit) {
    this.lockActions(true);

    if (typeof sfx !== "undefined") {
      if (isCrit && sfx.playCritHit) sfx.playCritHit();
      else if (sfx.playAttackHit) sfx.playAttackHit();
    }

    if (isCrit) {
      this.screenShake(true);
      this.vibrate([50, 40, 80]);
    } else {
      this.vibrate(35);
    }

    if (this.isNet) {
      this.ws.send(JSON.stringify({ type: "MOVE", action: "attack", crit: isCrit }));
      this.setLog(isCrit ? "МАТ НАЙДЕН • КРИТИЧЕСКИЙ УРОН" : "АТАКА • ОЖИДАНИЕ ХОДА");
    } else {
      this.runAiTurn("attack", isCrit);
    }
  },

  applyRoundResult(res) {
    const pCard = document.getElementById("player-card-anchor");
    const eCard = document.getElementById("enemy-card-anchor");

    this.enemyShield = (res.enemy_action === "defend");
    if (res.enemy_action === "attack") eCard?.classList.add("anim-lunge-down");
    if (res.enemy_action === "skill") {
      eCard?.classList.add("anim-skill-blast");
      if (this.enemyHero) {
        this.showSuperCutIn(this.enemyHero, this.enemyHero.skillName);
      }
    }

    this.updateHUD();

    setTimeout(() => {
      eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");

      const isCritAtk = res.dmg_dealt > (this.myHero.atk * 1.2);
      if (res.dmg_dealt > 0) {
        this.spawnDamageNumber("enemy-card-anchor", res.dmg_dealt, isCritAtk);
      }
      if (res.dmg_taken > 0) {
        this.spawnDamageNumber("player-card-anchor", res.dmg_taken, false);
      }

      if (typeof sfx !== "undefined") {
        if (res.dmg_taken > 0) {
          sfx.playDamageTaken();
          this.screenShake(false);
          this.vibrate(50);
        } else if (res.dmg_dealt > 0) {
          sfx.playDamageDealt();
          if (isCritAtk) this.screenShake(true);
        }
      }

      this.myHp = res.my_hp;
      this.enemyHp = res.enemy_hp;
      this.myEnergy = res.my_energy;
      this.enemyEnergy = res.enemy_energy;
      this.round = res.round;
      this.myShield = false;
      this.enemyShield = false;

      this.updateHUD();
      this.setLog(`УРОН: -${res.dmg_dealt} | ПОЛУЧЕНО: -${res.dmg_taken}`);
      this.fx(res.dmg_dealt >= res.dmg_taken ? "gold" : "red");

      setTimeout(() => {
        if (this.myHp <= 0 || this.enemyHp <= 0) {
          let outcome = 'lose';
          if (this.myHp <= 0 && this.enemyHp <= 0) outcome = 'draw';
          else if (this.myHp > 0) outcome = 'win';

          this.endBattle(outcome);
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

    const CRIT_BONUS = 3; // Честная прибавка +3 за мат в 1 ход

    let oppAct = this.enemyEnergy >= 2 ? "skill" : (Math.random() > 0.45 ? "attack" : "defend");

    let pDmg = 0;
    let eDmg = 0;
    let ignoreEnemyDef = false;
    let reflectDamageToEnemy = false;

    // -------------------------------------------------------------
    // 1. ДЕЙСТВИЕ ИГРОКА
    // -------------------------------------------------------------
    if (playerAct === "skill") {
      pCard?.classList.add("anim-skill-blast");
      this.myEnergy = 0;
      this.fx("gold");
      const skill = this.myHero.skillId;

      switch (skill) {
        case "ENIGMA_CHAMELEON": // Джокер (Энигма)
          if (oppAct === "attack") {
            reflectDamageToEnemy = true;
            this.setLog("ХАМЕЛЕОН: АТАКА ВРАГА ОТРАЖЕНА!");
          } else {
            this.enemyEnergy = Math.max(0, this.enemyEnergy - 1);
            this.myEnergy = 1;
            this.setLog("ХАМЕЛЕОН: ЭНЕРГИЯ ВРАГА ПОХИЩЕНА!");
          }
          pDmg = this.myHero.atk; // Честные 6 урона
          break;

        case "CARLSEN_ENDGAME": // Карлсен (Квантовый эндшпиль)
          const missingEnemyHp = 35 - this.enemyHp;
          pDmg = this.myHero.atk + Math.round(missingEnemyHp * 0.25); // 9 + добивание раненого
          this.setLog("ПРЕСС КАРЛСЕНА: ДОБИВАЮЩИЙ УРОН!");
          break;

        case "TAL_STORM": // Таль (Ярость шторма)
          this.myHp = Math.max(1, this.myHp - 3); // Жертвует 3 HP
          pDmg = this.myHero.atk + 4; // 10 + 4 = 14 чистейшего урона!
          this.spawnDamageNumber("player-card-anchor", 3, false);
          this.setLog("ЖЕРТВА ТАЛЯ: СОКРУШИТЕЛЬНЫЙ ШТОРМ!");
          break;

        case "CAPABLANCA_INTUITION": // Капабланка (Гениальная интуиция)
          ignoreEnemyDef = true;
          pDmg = this.myHero.atk + 2; // 6 + 2 = 8 сквозь любой блок
          this.setLog("ИНТУИЦИЯ: ИГНОРИРОВАНИЕ БРОНИ!");
          break;

        case "PETROSYAN_FORTRESS": // Петросян (Железная профилактика)
          this.myShield = true;
          this.myHp = Math.min(35, this.myHp + 7); // Исцеление +7 HP
          pDmg = Math.max(1, Math.round(this.myHero.atk * 0.5)); // 3 урона
          this.spawnDamageNumber("player-card-anchor", "+7", true);
          this.setLog("КРЕПОСТЬ: +7 HP И ПОЛНЫЙ БЛОК!");
          break;

        case "STOCKFISH_ENGINE": // Стокфиш (Суперкомпьютер)
          pDmg = this.myHero.atk; // 15 честного урона
          this.myHp = Math.min(35, this.myHp + 4);
          this.spawnDamageNumber("player-card-anchor", "+4", true);
          this.setLog("ОЦЕНКА +M1: КВАНТОВЫЙ КОЛЛАПС!");
          break;

        case "NAKAMURA_SURVIVAL": // Накамура (Экстремальное выживание)
          pDmg = this.myHero.atk; // 7 урона
          if (this.myHp <= 12) {
            this.myHp = Math.min(35, this.myHp + 10);
            this.spawnDamageNumber("player-card-anchor", "+10", true);
            this.setLog("ЦЕЙТНОТНЫЙ КАМБЭК: +10 HP!");
          }
          break;

        case "RUBINSTEIN_HARMONY": // Рубинштейн (Ладейная гармония)
          pDmg = this.myHero.atk; // 5 урона
          const heal = Math.max(1, Math.round(pDmg * 0.5)); // Лечит 3 HP
          this.myHp = Math.min(35, this.myHp + heal);
          this.spawnDamageNumber("player-card-anchor", `+${heal}`, true);
          this.setLog("ГАРМОНИЯ: ВАМПИРИЗМ ЭНДШПИЛЯ!");
          break;

        case "FISCHER_TORNADO": // Фишер (Ментальный торнадо)
          ignoreEnemyDef = true;
          pDmg = this.myHero.atk + 3; // 8 + 3 = 11 сквозь блок
          this.setLog("ПАРТИЯ ВЕКА: НЕОТРАЗИМЫЙ ТОРНАДО!");
          break;

        case "KASPAROV_ADVENTURE": // Каспаров (Дух приключений)
          pDmg = this.myHero.atk + 2; // 10 + 2 = 12 урона
          this.myEnergy = 1; // Сохранение темпа (+1⚡)
          if (this.enemyShield) {
            const halfBlock = Math.round(this.enemyHero.def * 0.5);
            pDmg = Math.max(2, pDmg - halfBlock);
          }
          this.screenShake(true);
          this.setLog("ДУХ ПРИКЛЮЧЕНИЙ: ШТУРМ И СОХРАНЕНИЕ ТЕМПА (+1⚡)!");
          break;

        case "STEINITZ_EQUILIBRIUM": // Стейниц (Теория равновесия)
          ignoreEnemyDef = true;
          pDmg = this.myHero.atk; // 6 чистых
          this.enemyHero.atk = Math.max(2, this.enemyHero.atk - 2); // Снижает атаку врага на 2 навсегда
          this.setLog("РАВНОВЕСИЕ: АТАКА ВРАГА СНИЖЕНА НА 2!");
          break;

        case "LASKER_GAMBIT": // Ласкер (Психологический гамбит)
          pDmg = this.myHero.atk + 2; // 7 + 2 = 9 урона
          this.setLog("ГАМБИТ: ПСИХОЛОГИЧЕСКИЙ УДАР!");
          break;

        case "BOTVINNIK_ARCHITECT": // Ботвинник (Архитектор мысли)
          pDmg = this.myHero.atk + 1; // 7 урона
          this.myShield = true;
          this.setLog("АРХИТЕКТОР: УДАР И ЖЕЛЕЗНЫЙ КАРКАС!");
          break;

        case "CARUANA_PALACE": // Каруана (Дворец теней)
          pDmg = this.myHero.atk + 1; // 9 урона
          this.enemyEnergy = 0; // Сжигает энергию врага
          this.setLog("ДВОРЕЦ ТЕНЕЙ: ЭНЕРГИЯ ВРАГА СБРОШЕНА!");
          break;

        case "GUKESH_MIND": // Гукеш (Сакральный разум)
          pDmg = this.myHero.atk + 2; // 9 урона
          this.setLog("САКРАЛЬНЫЙ РАЗУМ: ТОЧНЫЙ РАСЧЕТ!");
          break;

        case "SMYSLOV_SYMPHONY": // Смыслов (Магистр гармонии)
          pDmg = this.myHero.atk; // 6 урона
          if (this.myHp < this.enemyHp) {
            this.myHp = Math.min(35, this.myHp + 4);
            this.spawnDamageNumber("player-card-anchor", "+4", true);
            this.setLog("МАГИСТР ГАРМОНИИ: ВЫРАВНИВАНИЕ БАЛАНСА!");
          }
          break;

        case "DING_DRAGON": // Дин Лижэнь (Воля дракона)
          pDmg = this.myHero.atk + 2; // 9 урона
          this.setLog("ВОЛЯ ДРАКОНА: РЕЖИМ БЕРСЕРКА!");
          break;

        default:
          pDmg = this.myHero.atk + 1;
          break;
      }
    } else if (playerAct === "attack") {
      pCard?.classList.add("anim-lunge-up");
      // Честная атака: значение атаки с карточки + 3 при решении мата в 1 ход
      pDmg = this.myHero.atk + (isCrit ? CRIT_BONUS : 0);
    } else if (playerAct === "defend") {
      this.myShield = true;
    }

    // -------------------------------------------------------------
    // 2. ДЕЙСТВИЕ СОПЕРНИКА
    // -------------------------------------------------------------
    if (oppAct === "attack") {
      eCard?.classList.add("anim-lunge-down");
      eDmg = this.enemyHero.atk; // Честная атака врага с карточки
    } else if (oppAct === "skill") {
      eCard?.classList.add("anim-skill-blast");
      eDmg = this.enemyHero.atk + 2;
      this.enemyEnergy = 0;
      this.showSuperCutIn(this.enemyHero, this.enemyHero.skillName);
    } else {
      this.enemyShield = true;
      this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
    }

    // -------------------------------------------------------------
    // 3. ОТРАЖЕНИЕ (ХАМЕЛЕОН ЭНИГМЫ)
    // -------------------------------------------------------------
    if (reflectDamageToEnemy) {
      pDmg += eDmg;
      eDmg = 0;
    }

    // -------------------------------------------------------------
    // 4. ПРИМЕНЕНИЕ БЛОКА (1 К 1 С ЗАЩИТОЙ КАРТОЧКИ)
    // -------------------------------------------------------------
    if (this.enemyShield && !ignoreEnemyDef && pDmg > 0) {
      // Защита блокирует ровно столько, сколько написано на карточке врага
      pDmg = Math.max(1, pDmg - this.enemyHero.def);
    }

    if (this.myShield && eDmg > 0) {
      // Защита блокирует ровно столько, сколько написано на карточке игрока
      eDmg = Math.max(1, eDmg - this.myHero.def);
    }

    // Цифры урона в воздухе
    if (pDmg > 0) this.spawnDamageNumber("enemy-card-anchor", pDmg, isCrit || playerAct === "skill");
    if (eDmg > 0) this.spawnDamageNumber("player-card-anchor", eDmg, false);

    this.enemyHp = Math.max(0, this.enemyHp - pDmg);
    this.myHp = Math.max(0, this.myHp - eDmg);
    this.round++;

    if (typeof sfx !== "undefined") {
      if (eDmg > 0) sfx.playDamageTaken();
      if (pDmg > 0) sfx.playDamageDealt();
    }

    setTimeout(() => {
      eCard?.classList.remove("anim-lunge-down", "anim-skill-blast");
      pCard?.classList.remove("anim-lunge-up", "anim-skill-blast");

      this.myShield = false;
      this.enemyShield = false;
      this.updateHUD();

      if (this.enemyHp <= 0 || this.myHp <= 0) {
        let outcome = 'lose';
        if (this.myHp <= 0 && this.enemyHp <= 0) outcome = 'draw';
        else if (this.myHp > 0) outcome = 'win';
        this.endBattle(outcome);
      } else {
        this.lockActions(false);
        this.setLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
      }
    }, 700);
  },

  endBattle(outcome) {
    this.lockActions(true);

    const isWin = (outcome === 'win');
    const isDraw = (outcome === 'draw');

    this.fx(isWin ? "gold" : (isDraw ? "cyan" : "red"));

    const victoryModal = document.getElementById("duel-victory-modal");
    const titleEl = document.getElementById("victory-title");
    const subEl = document.getElementById("victory-subtitle");
    const avatarEl = document.getElementById("victory-avatar-img");
    const nameEl = document.getElementById("victory-winner-name");
    const detailsEl = document.getElementById("victory-details-text");
    const crownEl = document.getElementById("victory-crown");

    if (isDraw) {
      if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
      if (crownEl) crownEl.innerText = "♚ ♚";
      if (titleEl) {
        titleEl.innerText = "БОЕВАЯ НИЧЬЯ";
        titleEl.style.color = "#00ffcc";
      }
      if (subEl) subEl.innerText = "НИКТО НЕ УСТУПИЛ";
      if (avatarEl) avatarEl.src = this.myHero.img;
      if (nameEl) nameEl.innerText = `${this.myHero.name} & ${this.enemyHero.name}`;
      if (detailsEl) detailsEl.innerHTML = `Оба короля пали в ожесточенной битве на <b>${this.round} раунде</b>!`;
    } else if (isWin) {
      if (typeof sfx !== "undefined" && sfx.playFanfare) sfx.playFanfare();
      this.vibrate([100, 50, 150]);
      if (crownEl) crownEl.innerText = "♚";
      if (titleEl) {
        titleEl.innerText = "ШАХ И МАТ";
        titleEl.style.color = "#f1c40f";
      }
      if (subEl) subEl.innerText = "ВЕЛИКОЛЕПНАЯ ПОБЕДА";
      if (avatarEl) avatarEl.src = this.myHero.img;
      if (nameEl) nameEl.innerText = this.myHero.name;
      if (detailsEl) detailsEl.innerHTML = `Вы одержали триумф на <b>${this.round} раунде</b>!`;
    } else {
      if (typeof sfx !== "undefined" && sfx.playCheckmate) sfx.playCheckmate();
      this.vibrate(200);
      if (crownEl) crownEl.innerText = "♚";
      if (titleEl) {
        titleEl.innerText = "ПАРТИЯ ОКОНЧЕНА";
        titleEl.style.color = "#ff4d6d";
      }
      if (subEl) subEl.innerText = "ПОБЕДИЛ СОПЕРНИК";
      if (avatarEl) avatarEl.src = this.enemyHero.img;
      if (nameEl) nameEl.innerText = this.enemyHero.name;
      if (detailsEl) detailsEl.innerHTML = `Победу одержал оппонент на <b>${this.round} раунде</b>.`;
    }

    setTimeout(() => {
      victoryModal?.classList.add("active");
    }, 450);
  },

  closeVictoryModal() {
    document.getElementById("duel-victory-modal")?.classList.remove("active");
    document.getElementById("net-battle-overlay").style.display = "none";
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (typeof stopAllTargetVideosImmediate === "function") {
      stopAllTargetVideosImmediate();
    }
    this.lockActions(false);
  },

  fx(color) {
    const div = document.createElement("div");
    div.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 400);
  }
};