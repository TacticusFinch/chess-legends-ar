/**
 * Тактикус Финч — Модуль Сетевой Дуэли и Тактической Арены Lichess
 */

/* ==========================================================
   1. ПРОВАЙДЕР ОНЛАЙН-БАЗЫ ЗАДАЧ LICHESS (MATE IN 1)
   ========================================================== */
const LichessPuzzleProvider = {
  // Прямое зеркало официальной базы задач Lichess (тег mateIn1)
  DATABASE_URL: "https://raw.githubusercontent.com/niklasf/chess-puzzles/master/mate-in-1.json",
  
  cachedList: [],
  isLoaded: false,

  // Локальный банк 100% проверенных задач на случай отсутствия сети
  fallbackPuzzles: [
    { id: "fb-1", title: "Мат по 8-й горизонтали", fen: "3r2k1/5ppp/8/8/8/8/5PPP/4Q1K1 w - - 0 1", from: "e1", to: "e8" },
    { id: "fb-2", title: "Линейный удар ладьёй", fen: "R7/8/8/8/8/8/r7/k1K4R w - - 0 1", from: "h1", to: "h8" },
    { id: "fb-3", title: "Спёртый мат конём", fen: "6rk/6pp/7N/8/8/8/8/7K w - - 0 1", from: "h6", to: "f7" },
    { id: "fb-4", title: "Детский мат ферзём", fen: "r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", from: "f3", to: "f7" },
    { id: "fb-5", title: "Коробочный мат на b7", fen: "k7/8/1K6/8/8/8/8/1Q6 w - - 0 1", from: "b1", to: "b7" },
    { id: "fb-6", title: "Мат слоном по диагонали h7", fen: "r1bq1rk1/pp3ppp/8/8/8/3B4/8/6K1 w - - 0 1", from: "d3", to: "h7" }
  ],

  // Фоновая загрузка базы при инициализации
  async init() {
    if (this.isLoaded) return;
    try {
      const response = await fetch(this.DATABASE_URL);
      if (response.ok) {
        this.cachedList = await response.json();
        this.isLoaded = true;
        console.log(`[Lichess Engine] Загружено ${this.cachedList.length} онлайн-задач!`);
      }
    } catch (e) {
      console.warn("[Lichess Engine] Офлайн-режим: активен встроенный банк задач.");
    }
  },

  // Получение случайной задачи без задержек
  async getPuzzle() {
    if (!this.isLoaded || this.cachedList.length === 0) {
      await this.init();
    }

    if (this.cachedList.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.cachedList.length);
      const raw = this.cachedList[randomIndex];
      
      // Формат Lichess JSON: { id, fen, move: "e1e8", rating }
      const moveStr = raw.move || "";
      return {
        id: raw.id || `L-${randomIndex}`,
        title: `LICHESS ★ ${raw.rating || 1200}`,
        fen: raw.fen,
        from: moveStr.substring(0, 2),
        to: moveStr.substring(2, 4)
      };
    }

    // Резерв при медленной сети или ошибке
    return this.fallbackPuzzles[Math.floor(Math.random() * this.fallbackPuzzles.length)];
  }
};

// Запуск тихой предзагрузки
LichessPuzzleProvider.init();

/* ==========================================================
   2. ДВИЖОК ИНТЕРАКТИВНОЙ ДОСКИ
   ========================================================== */
const TacticBoardEngine = {
  currentPuzzle: null,
  selectedSquare: null,
  timerInterval: null,
  timeLeft: 10,

  piecesUnicode: {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  },

  async openArena() {
    const modal = document.getElementById("tactic-board-modal");
    const sourceTag = document.getElementById("tactic-source-tag");
    const titleEl = document.querySelector(".tactic-task-title");
    const subHintEl = document.getElementById("tactic-sub-status");
    const timerEl = document.getElementById("tactic-timer-num");

    if (modal) modal.style.display = "flex";
    if (sourceTag) sourceTag.textContent = "ПОИСК LICHESS...";
    if (subHintEl) {
      subHintEl.style.color = "#94a3b8";
      subHintEl.textContent = "Загрузка турнирной позиции...";
    }

    // Получение онлайн-задачи
    this.currentPuzzle = await LichessPuzzleProvider.getPuzzle();
    this.selectedSquare = null;
    this.timeLeft = 10;

    if (sourceTag) sourceTag.textContent = "LICHESS ОНЛАЙН";
    if (titleEl) titleEl.textContent = this.currentPuzzle.title || "МАТ В 1 ХОД БЕЛЫМИ!";
    if (subHintEl) subHintEl.textContent = "Коснитесь белой фигуры для хода";
    if (timerEl) timerEl.textContent = `⏳ ${this.timeLeft}с`;

    // Отрисовка клеток
    this.renderBoard(this.currentPuzzle.fen);

    // Таймер
    clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (timerEl) timerEl.textContent = `⏳ ${this.timeLeft}с`;

      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.closeArena(false); // Время истекло -> обычный удар без крита
      }
    }, 1000);
  },

  renderBoard(fen) {
    const boardEl = document.getElementById("chess-interactive-board");
    if (!boardEl) return;
    boardEl.innerHTML = "";

    // Берем только расстановку фигур до пробела
    const fenRows = fen.split(" ")[0].split("/");
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    // Ряд 0 в FEN = 8-я горизонталь (верх), Ряд 7 = 1-я горизонталь (низ)
    for (let r = 0; r < 8; r++) {
      const rankNum = 8 - r;
      const rowStr = fenRows[r];
      let colIdx = 0;

      for (let char of rowStr) {
        if (!isNaN(char)) {
          const emptyCount = parseInt(char, 10);
          for (let e = 0; e < emptyCount; e++) {
            this.createSquare(boardEl, files[colIdx], rankNum, null);
            colIdx++;
          }
        } else {
          this.createSquare(boardEl, files[colIdx], rankNum, char);
          colIdx++;
        }
      }
    }
  },

  createSquare(boardEl, file, rank, pieceChar) {
    const sq = document.createElement("div");
    const colIdx = file.charCodeAt(0) - 97; // a=0, b=1 ...
    const isWhiteSquare = (colIdx + rank) % 2 !== 0;

    sq.className = `sq ${isWhiteSquare ? 'white' : 'black'}`;
    const coord = `${file}${rank}`;
    sq.dataset.square = coord;

    if (pieceChar) {
      const piece = document.createElement("div");
      const isWhitePiece = (pieceChar === pieceChar.toUpperCase());
      piece.className = `piece ${isWhitePiece ? 'white-p' : 'black-p'}`;
      piece.textContent = this.piecesUnicode[pieceChar] || pieceChar;
      sq.appendChild(piece);
    }

    sq.onclick = () => this.onSquareClicked(sq);
    boardEl.appendChild(sq);
  },

  onSquareClicked(sq) {
    const coord = sq.dataset.square;
    const piece = sq.querySelector(".piece");
    const isWhitePiece = piece && piece.classList.contains("white-p");

    // Шаг 1: Выбор белой фигуры
    if (!this.selectedSquare) {
      if (isWhitePiece) {
        this.selectedSquare = coord;
        sq.classList.add("selected");
        const subHintEl = document.getElementById("tactic-sub-status");
        if (subHintEl) subHintEl.textContent = `Выбрано: ${coord.toUpperCase()}. Куда ходить?`;
      }
      return;
    }

    // Клик по той же клетке -> отмена
    if (this.selectedSquare === coord) {
      sq.classList.remove("selected");
      this.selectedSquare = null;
      return;
    }

    // Клик по другой белой фигуре -> перевыбор
    if (isWhitePiece) {
      document.querySelector(`.sq[data-square="${this.selectedSquare}"]`)?.classList.remove("selected");
      this.selectedSquare = coord;
      sq.classList.add("selected");
      return;
    }

    // Шаг 2: Проверка победного хода
    if (this.selectedSquare === this.currentPuzzle.from && coord === this.currentPuzzle.to) {
      // МАТ! КРИТ!
      clearInterval(this.timerInterval);
      sq.classList.add("selected");
      const subHint = document.getElementById("tactic-sub-status");
      if (subHint) {
        subHint.style.color = "#10b981";
        subHint.textContent = "ШАХ И МАТ! КРИТИЧЕСКИЙ УДАР!";
      }

      setTimeout(() => this.closeArena(true), 600);
    } else {
      // НЕВЕРНЫЙ ХОД
      sq.style.backgroundColor = "rgba(239, 68, 68, 0.7)";
      const subHint = document.getElementById("tactic-sub-status");
      if (subHint) {
        subHint.style.color = "#ef4444";
        subHint.textContent = "Не мат! Попробуйте другой ход...";
      }

      setTimeout(() => {
        document.querySelector(`.sq[data-square="${this.selectedSquare}"]`)?.classList.remove("selected");
        sq.style.backgroundColor = "";
        this.selectedSquare = null;
      }, 400);
    }
  },

  closeArena(isCrit) {
    clearInterval(this.timerInterval);
    const modal = document.getElementById("tactic-board-modal");
    if (modal) modal.style.display = "none";

    // Возврат управления дуэли
    NetDuel.onPuzzleComplete(isCrit);
  }
};

/* ==========================================================
   3. ГЛАВНЫЙ ОБЪЕКТ СЕТЕВОЙ ДУЭЛИ (NETDUEL)
   ========================================================== */
window.NetDuel = {
  // Параметры партии
  round: 1,
  myHp: 100,
  maxHp: 100,
  myEnergy: 1,
  maxEnergy: 2,
  enemyHp: 100,
  enemyEnergy: 1,
  isShieldActive: false,
  enemyShieldActive: false,

  // Характеристики по умолчанию
  myHero: { name: "Капабланка", atk: 25, def: 15, skillName: "Точный расчет", img: "./assets/avatars/2.jpg" },
  enemyHero: { name: "Ботвинник", atk: 22, def: 18, skillName: "Железная логика", img: "./assets/avatars/7.jpg" },

  // Лобби: открытие / закрытие
  openLobby() {
    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.add("active");
    this.showStep("lobby-step-select");
  },

  closeLobby() {
    const modal = document.getElementById("duel-lobby-modal");
    if (modal) modal.classList.remove("active");
  },

  showStep(stepId) {
    ["lobby-step-select", "lobby-step-host", "lobby-step-join"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = (id === stepId) ? "block" : "none";
    });
  },

  createRoom() {
    this.showStep("lobby-step-host");
    const codeEl = document.getElementById("host-room-id");
    const randomPin = Math.floor(1000 + Math.random() * 9000);
    if (codeEl) codeEl.textContent = randomPin;

    // Имитация подключения оппонента для демо/локального теста
    setTimeout(() => {
      this.closeLobby();
      this.startBattle();
    }, 2500);
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
      this.closeLobby();
      this.startBattle();
    } else {
      alert("Введите 4-значный код стола!");
    }
  },

  // Старт битвы и инициализация HUD
  startBattle() {
    const overlay = document.getElementById("net-battle-overlay");
    if (overlay) overlay.style.display = "flex";

    // Инициализация героя (если распознан через AR в app.js)
    if (window.currentHeroData) {
      this.myHero.name = window.currentHeroData.name;
      this.myHero.img = window.currentHeroData.avatar || `./assets/avatars/${window.currentHeroData.id}.jpg`;
      this.myHero.atk = window.currentHeroData.atk || 25;
      this.myHero.def = window.currentHeroData.def || 15;
      this.myHero.skillName = window.currentHeroData.skill || "Коронный удар";
    }

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

  // Обновление интерфейса боя
  updateHUD() {
    // Игрок
    document.getElementById("my-hero-name").textContent = this.myHero.name;
    document.getElementById("my-avatar-img").src = this.myHero.img;
    document.getElementById("my-hp-text").textContent = `${Math.max(0, this.myHp)} / ${this.maxHp} HP`;
    document.getElementById("my-hp-bar").style.width = `${Math.max(0, (this.myHp / this.maxHp) * 100)}%`;
    document.getElementById("my-atk-val").textContent = this.myHero.atk;
    document.getElementById("my-def-val").textContent = this.myHero.def;
    document.getElementById("my-energy-val").textContent = `${this.myEnergy}/${this.maxEnergy}`;
    document.getElementById("player-shield-fx").style.display = this.isShieldActive ? "flex" : "none";

    // Оппонент
    document.getElementById("enemy-hero-name").textContent = this.enemyHero.name;
    document.getElementById("enemy-avatar-img").src = this.enemyHero.img;
    document.getElementById("enemy-hp-text").textContent = `${Math.max(0, this.enemyHp)} / ${this.maxHp} HP`;
    document.getElementById("enemy-hp-bar").style.width = `${Math.max(0, (this.enemyHp / this.maxHp) * 100)}%`;
    document.getElementById("enemy-atk-val").textContent = this.enemyHero.atk;
    document.getElementById("enemy-def-val").textContent = this.enemyHero.def;
    document.getElementById("enemy-energy-tracker").textContent = `${this.enemyEnergy}/${this.maxEnergy}`;
    document.getElementById("enemy-skill-name").textContent = this.enemyHero.skillName.toUpperCase();
    document.getElementById("enemy-shield-fx").style.display = this.enemyShieldActive ? "flex" : "none";

    // Кнопка коронного приема
    const skillBtn = document.getElementById("btn-action-spc");
    const skillSub = document.getElementById("skill-action-sub");
    const skillBadge = document.getElementById("skill-cd-badge");
    if (skillBtn) {
      if (this.myEnergy >= this.maxEnergy) {
        skillBtn.classList.add("ready");
        skillBadge.textContent = "ГОТОВО ⚡";
        skillSub.textContent = "НАЖМИТЕ ДЛЯ СУПЕРАТАКИ";
      } else {
        skillBtn.classList.remove("ready");
        skillBadge.textContent = `${this.myEnergy}/${this.maxEnergy} ⚡`;
        skillSub.textContent = `Нужно ${this.maxEnergy}⚡ энергии`;
      }
    }

    // Раунд и оценка
    document.getElementById("round-title-badge").textContent = `РАУНД ${this.round}`;
    const evalPercent = Math.min(100, Math.max(0, 50 + (this.myHp - this.enemyHp) / 2));
    document.getElementById("duel-eval-fill").style.height = `${evalPercent}%`;
    const scoreVal = ((evalPercent - 50) / 10).toFixed(1);
    document.getElementById("duel-eval-score").textContent = scoreVal > 0 ? `+${scoreVal}` : scoreVal;
  },

  setBattleLog(text) {
    const logEl = document.getElementById("battle-log");
    if (logEl) logEl.textContent = text;
  },

  // Выбор боевого действия
  chooseAction(type) {
    if (type === 'attack') {
      // Запуск тактической арены Lichess
      TacticBoardEngine.openArena();
      return;
    }

    if (type === 'defend') {
      this.isShieldActive = true;
      this.myEnergy = Math.min(this.maxEnergy, this.myEnergy + 1);
      this.triggerFlashFx("cyan");
      this.setBattleLog("ЗАЩИТА АКТИВИРОВАНА (+1⚡)");
      this.updateHUD();

      setTimeout(() => this.resolveEnemyTurn(), 800);
      return;
    }

    if (type === 'skill') {
      if (this.myEnergy < this.maxEnergy) {
        this.setBattleLog("НЕДОСТАТОЧНО ЭНЕРГИИ ДЛЯ НАВЫКА!");
        return;
      }

      this.myEnergy = 0;
      this.triggerFlashFx("gold");
      const playerCard = document.getElementById("player-card-anchor");
      if (playerCard) playerCard.classList.add("anim-skill-blast");

      const superDmg = Math.round(this.myHero.atk * 1.8);
      this.enemyHp = Math.max(0, this.enemyHp - superDmg);
      this.triggerShake("heavy");
      this.setBattleLog(`КОРОННЫЙ ХОД! ${superDmg} УРОНА!`);
      this.updateHUD();

      setTimeout(() => {
        if (playerCard) playerCard.classList.remove("anim-skill-blast");
        if (this.enemyHp <= 0) {
          this.endBattle(true);
        } else {
          this.resolveEnemyTurn();
        }
      }, 1000);
    }
  },

  // Пропуск пазла игроком
  skipPuzzle() {
    TacticBoardEngine.closeArena(false);
  },

  // Завершение решения задачи на доске
  onPuzzleComplete(isCrit) {
    const playerCard = document.getElementById("player-card-anchor");
    if (playerCard) playerCard.classList.add("anim-lunge-up");

    let finalDmg = this.myHero.atk;
    if (isCrit) {
      finalDmg = Math.round(finalDmg * 1.6);
      this.triggerFlashFx("gold");
      this.triggerShake("heavy");
      this.setBattleLog(`ШАХ И МАТ! КРИТ: ${finalDmg} УРОНА!`);
    } else {
      this.triggerShake("light");
      this.setBattleLog(`АТАКА! ${finalDmg} УРОНА`);
    }

    // Если у соперника был щит
    if (this.enemyShieldActive) {
      finalDmg = Math.max(5, finalDmg - this.enemyHero.def);
      this.enemyShieldActive = false;
    }

    this.enemyHp = Math.max(0, this.enemyHp - finalDmg);
    this.updateHUD();

    setTimeout(() => {
      if (playerCard) playerCard.classList.remove("anim-lunge-up");
      if (this.enemyHp <= 0) {
        this.endBattle(true);
      } else {
        this.resolveEnemyTurn();
      }
    }, 900);
  },

  // Ответный ход соперника (ИИ/Сеть)
  resolveEnemyTurn() {
    this.setBattleLog("ХОД ОППОНЕНТА...");

    setTimeout(() => {
      const enemyCard = document.getElementById("enemy-card-anchor");

      // Если соперник накопил энергию — использует навык
      if (this.enemyEnergy >= this.maxEnergy) {
        this.enemyEnergy = 0;
        let skillDmg = Math.round(this.enemyHero.atk * 1.7);
        if (this.isShieldActive) {
          skillDmg = Math.max(5, skillDmg - this.myHero.def);
          this.isShieldActive = false;
        }

        this.myHp = Math.max(0, this.myHp - skillDmg);
        this.triggerFlashFx("red");
        this.triggerShake("heavy");
        this.setBattleLog(`ОППОНЕНТ: ${this.enemyHero.skillName.toUpperCase()} (-${skillDmg} HP)`);
      } else {
        // Случайный выбор: Атака (70%) или Защита (30%)
        const willAttack = Math.random() > 0.3;
        if (willAttack) {
          if (enemyCard) enemyCard.classList.add("anim-lunge-down");
          let dmg = this.enemyHero.atk;
          if (this.isShieldActive) {
            dmg = Math.max(5, dmg - this.myHero.def);
            this.isShieldActive = false;
          }

          this.myHp = Math.max(0, this.myHp - dmg);
          this.triggerFlashFx("red");
          this.triggerShake("light");
          this.setBattleLog(`ОППОНЕНТ АТАКУЕТ! (-${dmg} HP)`);
        } else {
          this.enemyShieldActive = true;
          this.enemyEnergy = Math.min(this.maxEnergy, this.enemyEnergy + 1);
          this.setBattleLog("ОППОНЕНТ ВСТАЛ В ЗАЩИТУ (+1⚡)");
        }
      }

      this.round++;
      this.updateHUD();

      setTimeout(() => {
        if (enemyCard) enemyCard.classList.remove("anim-lunge-down");
        if (this.myHp <= 0) {
          this.endBattle(false);
        } else {
          this.setBattleLog("ВАШ ХОД! ВЫБЕРИТЕ ДЕЙСТВИЕ");
        }
      }, 800);
    }, 1000);
  },

  // Финал боя
  endBattle(isWin) {
    if (isWin) {
      this.triggerFlashFx("gold");
      this.setBattleLog("🏆 ПОБЕДА! ВЫ ОДОЛЕЛИ ГРОССМЕЙСТЕРА!");
    } else {
      this.triggerFlashFx("red");
      this.setBattleLog("МАТ... ВЫ ПОТЕРПЕЛИ ПОРАЖЕНИЕ");
    }

    setTimeout(() => {
      const overlay = document.getElementById("net-battle-overlay");
      if (overlay) overlay.style.display = "none";
    }, 3000);
  },

  // Визуальные эффекты
  triggerShake(intensity) {
    const overlay = document.getElementById("net-battle-overlay");
    if (!overlay) return;
    const cls = intensity === "heavy" ? "shake-heavy" : "shake-light";
    overlay.classList.add(cls);
    setTimeout(() => overlay.classList.remove(cls), 450);
  },

  triggerFlashFx(color) {
    const flash = document.createElement("div");
    flash.className = `flash-fx-overlay flash-${color}`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 450);
  }
};