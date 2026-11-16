// ==============================================================
// ДВИЖОК «МАШИНА ВРЕМЕНИ: КВАНТОВЫЙ ПЕРЕНОС В ЧЕМПИОНА»
// Структура:
// 1. Пролог: Перенос в тело чемпиона
// 2. Блок I: 7 Вопросов по биографии (с кнопкой «Изучить био»)
// 3. Блок II: 3 Тактических задачи
// 4. Блок III: 3 Дуэли с ростом рангов соперников
// 5. Блок IV: Финальный Босс — Хранитель Времени на Lichess
// 6. Награда: Сертификат ТОП-3 с верификацией
// ==============================================================

import { TOURNAMENT_CONFIG } from './heroes.js';

class ChronoSfx {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  warpSound() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.55);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.55);
  }

  successSound() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.2, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.25);
    });
  }

  hitSound() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  fanfareSound() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [440, 554, 659, 880, 1108].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.12);
      gain.gain.setValueAtTime(0.25, now + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.4);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });
  }

  collapseSound() {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }
}

export const chronoSfx = new ChronoSfx();

export class TimeMachineSession {
  constructor(hero, elements, onFinish) {
    this.hero = hero;
    this.elements = elements;
    this.onFinish = onFinish;

    // СИСТЕМА ЖИЗНЕЙ ТУРНИРНОГО КОНКУРСА
    // Оптимальный баланс: 5 жизней (на 7 вопросов био, 3 тактики и 3 дуэли)
    this.maxLives = 5;
    this.lives = this.loadPersistentLives();

    // Состояния прохождения
    this.currentBioIdx = 0; // 0..6 (ровно 7 вопросов)
    this.currentTacIdx = 0; // 0..2 (ровно 3 тактики)
    this.currentDuelTier = 0; // 0..2 (ровно 3 дуэли)

    // Боевые параметры дуэлей (синхронизированы со шкалой 50 HP из net-duel.js)
    this.playerHp = 50;
    this.enemyHp = 50;
    this.enemyMaxHp = 50;
    this.playerEnergy = 1;
    this.enemyEnergy = 1;
    this.playerShield = false;
    this.enemyShield = false;

    // Верификация Lichess
    this.playerLichessNick = "";
  }

  // Постоянный контроль дисквалификации через localStorage (с защитой от сброса)
  getStorageKey() {
    return `chrono_quest_${this.hero.id}`;
  }

  loadPersistentLives() {
    try {
      const data = localStorage.getItem(this.getStorageKey());
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.disqualified) return 0;
        if (typeof parsed.lives === "number") return parsed.lives;
      }
    } catch (e) {}
    return this.maxLives;
  }

  savePersistentLives() {
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify({
        lives: this.lives,
        disqualified: this.lives <= 0,
        heroId: this.hero.id,
        timestamp: Date.now()
      }));
    } catch (e) {}
  }

  isDisqualified() {
    return this.lives <= 0;
  }

  start() {
    chronoSfx.warpSound();
    if (this.isDisqualified()) {
      this.renderGameOver("Критический хроно-коллапс! Карточка заблокирована");
      return;
    }
    this.renderPrologue();
  }

  updateLivesUI(shake = false) {
    const tracker = document.getElementById('chrono-lives-tracker');
    const overlay = document.getElementById('tm-overlay');

    if (tracker) {
      tracker.innerHTML = '';
      for (let i = 1; i <= this.maxLives; i++) {
        const span = document.createElement('span');
        span.className = `chrono-heart ${i <= this.lives ? '' : 'lost'}`;
        span.innerText = i <= this.lives ? '❤️' : '💔';
        tracker.appendChild(span);
      }
    }

    if (shake) {
      if (tracker) tracker.classList.add('heart-broken-anim');
      if (overlay) overlay.classList.add('screen-shake');
      setTimeout(() => {
        if (tracker) tracker.classList.remove('heart-broken-anim');
        if (overlay) overlay.classList.remove('screen-shake');
      }, 450);
    }
  }

  loseLife(reason) {
    this.lives = Math.max(0, this.lives - 1);
    this.savePersistentLives();
    chronoSfx.hitSound();
    this.updateLivesUI(true);

    if (this.lives <= 0) {
      setTimeout(() => {
        this.renderGameOver(reason);
      }, 700);
      return false; // Погиб
    }
    return true; // Жив, но потерял жизнь
  }

  updatePips(activeStage) {
    this.updateLivesUI(false);
    const { pipIntro, pipQuiz, pipTactics, pipBoss, chronoEpochText } = this.elements;
    if (chronoEpochText) {
      chronoEpochText.innerText = `ТЫ В ТЕЛЕ: ${this.hero.name.toUpperCase()} (${this.hero.era.split('•')[0].trim()})`;
    }

    const stages = [
      { id: 'prologue', el: pipIntro, title: '1. Перенос' },
      { id: 'bio', el: pipQuiz, title: `2. Био (${this.currentBioIdx + 1}/7)` },
      { id: 'tactics', el: pipTactics, title: `3. Тактика (${this.currentTacIdx + 1}/3)` },
      { id: 'duels', el: pipBoss, title: `4. Дуэли (${this.currentDuelTier + 1}/3)` },
      { id: 'lichess', el: null, title: '5. Хранитель' }
    ];

    if (pipIntro) pipIntro.innerText = stages[0].title;
    if (pipQuiz) pipQuiz.innerText = stages[1].title;
    if (pipTactics) pipTactics.innerText = stages[2].title;
    if (pipBoss) pipBoss.innerText = stages[3].title;

    const stageOrder = ['prologue', 'bio', 'tactics', 'duels', 'lichess', 'victory'];
    const curIdx = stageOrder.indexOf(activeStage);

    [pipIntro, pipQuiz, pipTactics, pipBoss].forEach((el, idx) => {
      if (!el) return;
      el.classList.remove('active', 'completed');
      if (idx < curIdx) el.classList.add('completed');
      else if (idx === curIdx) el.classList.add('active');
    });
  }

  // ================= 0. ПРОЛОГ: ПЕРЕНОС В ТЕЛО ЧЕМПИОНА =================
  renderPrologue() {
    this.updatePips('prologue');
    const p = this.hero.bodySwapIntro;

    this.elements.body.innerHTML = `
      <div class="tm-intro-hero">
        <div class="quantum-portal-ring">
          <div class="quantum-portal-core">${this.hero.chessPiece}</div>
        </div>
        <div class="tm-title" style="color: #ff4d6d;">КВАНТОВЫЙ ПЕРЕНОС!</div>
        <div class="tm-subtitle">ТЫ ОЧНУЛСЯ В ТЕЛЕ ${this.hero.name.toUpperCase()}</div>
      </div>

      <div class="tm-story-scroll">
        <p style="color: #f1c40f; font-weight: 800; font-size: 12px; margin-bottom: 8px;">
          ⚡ ПОРТАЛ ВРЕМЕНИ СРАБОТАЛ!
        </p>
        <p>${p.prologue}</p>
        <p style="margin-top: 8px; color: #00ffcc;">
          <strong>ВАША МИССИЯ:</strong> ${p.mission}
        </p>
        <div style="margin-top: 10px; padding: 10px; background: rgba(245,197,66,0.1); border-left: 3px solid var(--accent-gold); border-radius: 4px; font-size: 11px;">
          <b>РЕГЛАМЕНТ ТУРНИРА «МАШИНА ВРЕМЕНИ»:</b><br>
          1. 📜 <b>7 вопросов биографии</b> — вспомни факты своей жизни (все они есть в карточке героя!).<br>
          2. ⚔️ <b>3 тактических задачи</b> — повтори свои величайшие комбинации.<br>
          3. 🛡️ <b>3 дуэли</b> — одолей претендентов эпохи с ростом силы.<br>
          4. ⏳ <b>ФИНАЛЬНЫЙ БОСС:</b> партия с Ботом-Хранителем Времени на Lichess!<br>
          <span style="color: #f5c542; font-weight:800;">🏆 Первые трое участников получат суперприз турнира!</span>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top: auto;">
        <button class="tm-action-btn" id="btn-read-bio-first" style="flex:1; background: rgba(255,255,255,0.08); border:1px solid var(--accent-gold); color: #fff;">
          📖 Освежить биографию
        </button>
        <button class="tm-action-btn" id="btn-start-quest" style="flex:1.2;">
          В БОЙ ➔
        </button>
      </div>
    `;

    document.getElementById('btn-read-bio-first')?.addEventListener('click', () => {
      this.renderFullBioViewer();
    });

    document.getElementById('btn-start-quest')?.addEventListener('click', () => {
      chronoSfx.warpSound();
      this.currentBioIdx = 0;
      this.renderBioQuestion();
    });
  }

  // Просмотрщик 7 разделов биографии
  renderFullBioViewer() {
    this.elements.body.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
        <div class="modal-title" style="font-size: 14px; color: var(--accent-gold);">ХРОНИКИ: ${this.hero.name.toUpperCase()}</div>
        <button class="quiz-header-badge" id="btn-back-to-prologue" style="cursor:pointer; background:rgba(255,255,255,0.1); color:#fff; border:none;">← Назад</button>
      </div>

      <div class="tm-story-scroll" style="max-height: 380px;">
        ${this.hero.bio.map(b => `
          <div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 11px; font-weight:800; color:var(--neon-cyan); margin-bottom:3px;">${b.title}</div>
            <div style="font-size: 11px; color:#e2e8f0; line-height:1.45;">${b.text}</div>
          </div>
        `).join('')}
      </div>

      <button class="tm-action-btn" id="btn-start-quiz-from-bio">
        <span>Я запомнил всё! Начать тест (7 вопросов) ➔</span>
      </button>
    `;

    document.getElementById('btn-back-to-prologue')?.addEventListener('click', () => this.renderPrologue());
    document.getElementById('btn-start-quiz-from-bio')?.addEventListener('click', () => {
      chronoSfx.warpSound();
      this.currentBioIdx = 0;
      this.renderBioQuestion();
    });
  }

  // ================= 1. БЛОК I: 7 ВОПРОСОВ НА БИОГРАФИЮ =================
  renderBioQuestion() {
    this.updatePips('bio');
    const qList = this.hero.bioQuiz;
    const curQ = qList[this.currentBioIdx];

    this.elements.body.innerHTML = `
      <div style="margin-bottom: 8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="quiz-header-badge">БЛОК I: ПАМЯТЬ ЧЕМПИОНА</span>
          <span style="font-size:11px; font-weight:800; color:var(--neon-cyan);">${this.currentBioIdx + 1} ИЗ 7</span>
        </div>
        <div class="quiz-question-text">${curQ.q}</div>
      </div>

      <div class="quiz-options-list" id="bio-options">
        ${curQ.options.map((opt, i) => `
          <button class="quiz-opt-btn" data-opt-idx="${i}">
            ${opt.text}
          </button>
        `).join('')}
      </div>

      <div id="bio-feedback" class="quiz-feedback-box" style="display: none;"></div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top: auto;">
        <div style="font-size:10px; color:#ff4d6d; font-weight:700;">
          ⚠️ ТУРНИРНЫЙ РЕЖИМ: ОШИБКА = -1 ❤️
        </div>
        <button class="tm-action-btn" id="btn-next-bio" style="display: none; padding: 8px 14px;">
          <span>${this.currentBioIdx < 6 ? 'Следующий вопрос ➔' : 'К Блоку II: Тактика (3 задачи) ➔'}</span>
        </button>
      </div>
    `;

    const optButtons = this.elements.body.querySelectorAll('.quiz-opt-btn');
    const fb = document.getElementById('bio-feedback');
    const nextBtn = document.getElementById('btn-next-bio');

    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.optIdx, 10);
        const opt = curQ.options[idx];

        optButtons.forEach(b => {
          b.disabled = true;
          b.style.pointerEvents = 'none';
        });

        fb.style.display = 'block';

        if (opt.correct) {
          chronoSfx.successSound();
          btn.classList.add('correct');
          fb.style.background = 'rgba(46, 204, 113, 0.2)';
          fb.style.border = '1px solid #2ecc71';
          fb.style.color = '#2ecc71';
          fb.innerHTML = `<b>ПАМЯТЬ ВОССТАНОВЛЕНА!</b> ${opt.comment}`;
          nextBtn.style.display = 'flex';
        } else {
          btn.classList.add('wrong');
          const isAlive = this.loseLife("Ошибка в фактах биографии чемпиона");
          
          fb.style.background = 'rgba(231, 76, 60, 0.2)';
          fb.style.border = '1px solid #e74c3c';
          fb.style.color = '#e74c3c';
          
          if (isAlive) {
            fb.innerHTML = `<b>ХРОНО-ИСКАЖЕНИЕ! Потеряно 1 ❤️ (Осталось: ${this.lives}/3)</b><br>${opt.comment}<br><span style="color:#f5c542;">Соберитесь с мыслями, попробуйте снова!</span>`;

            setTimeout(() => {
              optButtons.forEach(b => {
                b.disabled = false;
                b.style.pointerEvents = 'auto';
                b.classList.remove('wrong');
              });
              fb.style.display = 'none';
            }, 1900);
          } else {
            fb.innerHTML = `<b>КВАНТОВЫЙ КОЛЛАПС!</b> Потрачены все 3 жизни!`;
          }
        }
      });
    });

    nextBtn?.addEventListener('click', () => {
      if (this.currentBioIdx < 6) {
        this.currentBioIdx++;
        this.renderBioQuestion();
      } else {
        chronoSfx.warpSound();
        this.currentTacIdx = 0;
        this.renderTacticsQuestion();
      }
    });
  }

  // ================= 2. БЛОК II: 3 ТАКТИЧЕСКИЕ ЗАДАЧИ =================
  renderTacticsQuestion() {
    this.updatePips('tactics');
    const tacList = this.hero.tactics;
    const curT = tacList[this.currentTacIdx];

    this.elements.body.innerHTML = `
      <div style="margin-bottom: 8px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <span class="quiz-header-badge" style="border-color: var(--accent-gold); color: var(--accent-gold); background: rgba(245, 197, 66, 0.1);">
            БЛОК II: ТАКТИКА ИЗ ТВОИХ ПАРТИЙ
          </span>
          <span style="font-size:11px; font-weight:800; color:var(--accent-gold);">${this.currentTacIdx + 1} ИЗ 3</span>
        </div>
        <div style="font-size: 12px; font-weight: 800; color: #fff; text-transform: uppercase;">${curT.title}</div>
        <div style="font-size: 11px; color: #cbd5e1; margin-top: 2px;">${curT.desc}</div>
      </div>

      <div class="chess-tactics-board-visual">
        <div class="tactics-banner">♟ БЕССМЕРТНАЯ КОМБИНАЦИЯ ♟</div>
      </div>

      <div class="quiz-options-list" id="tac-options">
        ${curT.options.map((opt, i) => `
          <button class="quiz-opt-btn" data-tac-idx="${i}">
            ${opt.text}
          </button>
        `).join('')}
      </div>

      <div id="tac-feedback" class="quiz-feedback-box" style="display: none;"></div>

      <button class="tm-action-btn" id="btn-next-tac" style="display: none;">
        <span>${this.currentTacIdx < 2 ? 'Следующая комбинация ➔' : 'К Блоку III: Турнирные дуэли ➔'}</span>
      </button>
    `;

    const optButtons = this.elements.body.querySelectorAll('.quiz-opt-btn');
    const fb = document.getElementById('tac-feedback');
    const nextBtn = document.getElementById('btn-next-tac');

    optButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tacIdx, 10);
        const opt = curT.options[idx];

        optButtons.forEach(b => {
          b.disabled = true;
          b.style.pointerEvents = 'none';
        });

        fb.style.display = 'block';

        if (opt.correct) {
          chronoSfx.successSound();
          btn.classList.add('correct');
          fb.style.background = 'rgba(46, 204, 113, 0.2)';
          fb.style.border = '1px solid #2ecc71';
          fb.style.color = '#2ecc71';
          fb.innerHTML = `<b>УДАР ГЕНИЯ!</b> ${opt.comment}`;
          nextBtn.style.display = 'flex';
        } else {
          btn.classList.add('wrong');
          const isAlive = this.loseLife("Грубый зевок в тактике чемпиона");
          
          fb.style.background = 'rgba(231, 76, 60, 0.2)';
          fb.style.border = '1px solid #e74c3c';
          fb.style.color = '#e74c3c';
          
          if (isAlive) {
            fb.innerHTML = `<b>ЗЕВОК! Потеряно 1 ❤️ (Осталось: ${this.lives}/3)</b><br>${opt.comment}`;

            setTimeout(() => {
              optButtons.forEach(b => {
                b.disabled = false;
                b.style.pointerEvents = 'auto';
                b.classList.remove('wrong');
              });
              fb.style.display = 'none';
            }, 1900);
          } else {
            fb.innerHTML = `<b>КВАНТОВЫЙ КОЛЛАПС!</b> Потрачены все 3 жизни!`;
          }
        }
      });
    });

    nextBtn?.addEventListener('click', () => {
      if (this.currentTacIdx < 2) {
        this.currentTacIdx++;
        this.renderTacticsQuestion();
      } else {
        chronoSfx.warpSound();
        this.currentDuelTier = 0;
        this.startDuelTier();
      }
    });
  }

  // ================= 3. БЛОК III: 3 ДУЭЛИ С РОСТОМ СИЛЫ (МЕХАНИКА NET-DUEL) =================
  startDuelTier() {
    this.updatePips('duels');
    const duelInfo = this.hero.duels[this.currentDuelTier];
    this.enemyMaxHp = duelInfo.hp || 50;
    this.enemyHp = this.enemyMaxHp;
    this.playerHp = 50;
    this.playerEnergy = 1;
    this.enemyEnergy = 1;
    this.playerShield = false;
    this.enemyShield = false;

    this.elements.body.innerHTML = `
      <div class="boss-arena-card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
          <span class="quiz-header-badge" style="border-color: #ff4d6d; color: #ff4d6d; background: rgba(255, 77, 109, 0.1);">
            БЛОК III: ДУЭЛЬ ${this.currentDuelTier + 1} ИЗ 3
          </span>
          <span style="font-size:10px; font-weight:800; color:var(--accent-gold);">
            РАНГ: ${duelInfo.opponentRank} (${duelInfo.skillName})
          </span>
        </div>

        <div class="boss-portrait-row">
          <div class="boss-avatar-frame" style="border-color: ${this.currentDuelTier === 2 ? '#f5c542' : '#38bdf8'};">
            ${this.currentDuelTier === 2 ? '♚' : (this.currentDuelTier === 1 ? '♛' : '♜')}
          </div>
          <div class="boss-meta-wrap">
            <div class="boss-name-text">${duelInfo.opponentName}</div>
            <div style="font-size:9px; color:#94a3b8;">${duelInfo.opponentTitle}</div>
            <div class="boss-quote-bubble" id="duel-speech">${duelInfo.introQuote}</div>
          </div>
        </div>

        <div class="hp-dual-strip">
          <div class="hp-tracker-col">
            <div class="hp-label-row">
              <span>СОПЕРНИК</span>
              <span id="enemy-hp-num">${this.enemyHp}/${this.enemyMaxHp}</span>
            </div>
            <div class="hp-track-bar">
              <div class="hp-fill-bar boss" id="enemy-hp-bar" style="width: 100%;"></div>
            </div>
          </div>

          <div class="hp-tracker-col">
            <div class="hp-label-row">
              <span>ТЫ (${this.hero.name.split(' ')[0].toUpperCase()})</span>
              <span id="player-hp-num">${this.playerHp}/50</span>
            </div>
            <div class="hp-track-bar">
              <div class="hp-fill-bar player" id="player-hp-bar" style="width: 100%;"></div>
            </div>
          </div>
        </div>

        <div class="boss-combat-log" id="duel-combat-log">
          Тактика противника: ${duelInfo.defText}. Выберите действие:
        </div>

        <div class="boss-actions-grid" id="duel-actions">
          <button class="boss-cmd-btn strike" id="duel-btn-strike">
            <span>⚔️ Фигурная атака</span>
            <small style="font-size: 8px; opacity: 0.8;">Базовый урон + темп</small>
          </button>
          <button class="boss-cmd-btn shield" id="duel-btn-defend">
            <span>🛡️ Защита + блок</span>
            <small style="font-size: 8px; opacity: 0.8;">Блок 75% + 1⚡ энергии</small>
          </button>
          <button class="boss-cmd-btn counter" id="duel-btn-counter">
            <span>⚡ Скилл: ${this.hero.name.split(' ')[1] || 'Чемпион'}</span>
            <small style="font-size: 8px; opacity: 0.8;" id="duel-skill-leds">Заряд: 1/2⚡</small>
          </button>
        </div>
      </div>
    `;

    document.getElementById('duel-btn-strike')?.addEventListener('click', () => this.handleDuelMove('strike'));
    document.getElementById('duel-btn-defend')?.addEventListener('click', () => this.handleDuelMove('defend'));
    document.getElementById('duel-btn-counter')?.addEventListener('click', () => this.handleDuelMove('counter'));
  }

  handleDuelMove(move) {
    const duelInfo = this.hero.duels[this.currentDuelTier];
    const log = document.getElementById('duel-combat-log');
    const actions = document.getElementById('duel-actions');
    const speech = document.getElementById('duel-speech');
    const leds = document.getElementById('duel-skill-leds');

    if (actions) actions.style.pointerEvents = 'none';

    let dmgToEnemy = 0;
    this.playerShield = false;

    if (move === 'counter') {
      if (this.playerEnergy < 2) {
        if (log) log.innerText = "НЕДОСТАТОЧНО ЭНЕРГИИ! Накопите 2⚡ ходом защиты.";
        if (actions) actions.style.pointerEvents = 'auto';
        return;
      }
      this.playerEnergy = 0;
      dmgToEnemy = 16;
      chronoSfx.fanfareSound();
      if (log) log.innerText = `⚡ СУПЕР-ПРИЕМ: Нанесен сокрушительный удар на 16 DMG!`;
    } else if (move === 'strike') {
      dmgToEnemy = Math.floor(Math.random() * 4) + 10;
      chronoSfx.hitSound();
      if (log) log.innerText = `🗡️ Вы провели стремительную атаку на ${dmgToEnemy} DMG!`;
    } else if (move === 'defend') {
      this.playerShield = true;
      this.playerEnergy = Math.min(2, this.playerEnergy + 1);
      dmgToEnemy = 3;
      chronoSfx.successSound();
      if (log) log.innerText = `🛡️ Железный щит активирован! (+1⚡ энергии, 3 DMG контратаки).`;
    }

    if (leds) leds.innerText = `Заряд: ${this.playerEnergy}/2⚡`;

    this.enemyHp = Math.max(0, this.enemyHp - dmgToEnemy);
    this.updateDuelHpBars();

    if (this.enemyHp <= 0) {
      if (speech) speech.innerText = duelInfo.defeatQuote;
      chronoSfx.successSound();
      setTimeout(() => {
        if (this.currentDuelTier < 2) {
          this.currentDuelTier++;
          this.startDuelTier();
        } else {
          this.renderLichessBossIntro();
        }
      }, 1400);
      return;
    }

    // Ответ противника из net-duel
    setTimeout(() => {
      let enemyDmg = duelInfo.atk;
      const isOppSkill = (this.enemyEnergy >= 2 || Math.random() > 0.7);

      if (isOppSkill) {
        this.enemyEnergy = 0;
        enemyDmg = 14;
        if (log) log.innerText = `💥 ${duelInfo.opponentName} применяет скилл «${duelInfo.skillName}» на 14 DMG!`;
      } else {
        this.enemyEnergy = Math.min(2, this.enemyEnergy + 1);
        if (log) log.innerText = `💥 ${duelInfo.opponentName} наносит удар фигурами: -${enemyDmg} HP!`;
      }

      if (this.playerShield) {
        enemyDmg = Math.max(2, Math.floor(enemyDmg * 0.25));
        if (log) log.innerText += ` Ваш щит поглотил урон (получено всего -${enemyDmg} HP).`;
      }

      chronoSfx.hitSound();
      this.playerHp = Math.max(0, this.playerHp - enemyDmg);
      this.updateDuelHpBars();

      if (this.playerHp <= 0) {
        if (log) log.innerText = `💀 Ваша оборона сломлена! Поражение в дуэли против ${duelInfo.opponentName}...`;
        const isAlive = this.loseLife(`Поражение в турнирной дуэли против ${duelInfo.opponentName}`);
        if (isAlive) {
          setTimeout(() => {
            this.startDuelTier();
          }, 1400);
        }
        return;
      }

      if (actions) actions.style.pointerEvents = 'auto';
    }, 1100);
  }

  // ================= ЭКРАН ДИСКВАЛИФИКАЦИИ / ВЫБЫВАНИЯ =================
  renderGameOver(reason) {
    chronoSfx.collapseSound();
    const { pipIntro, pipQuiz, pipTactics, pipBoss } = this.elements;
    [pipIntro, pipQuiz, pipTactics, pipBoss].forEach(p => p?.classList.remove('active'));

    this.elements.body.innerHTML = `
      <div class="tm-victory-box" style="padding: 16px 0;">
        <div style="font-size: 44px; margin-bottom: 6px;">⛔⏳💔</div>
        <div class="tm-title" style="color: #ff4d6d; font-size: 16px;">ВЫБЫВАНИЕ ИЗ КОНКУРСА</div>
        <div class="tm-subtitle">КВАНТОВАЯ ЭНЕРГИЯ ИССЯКЛА (0/5 ЖИЗНЕЙ)</div>

        <div style="background: rgba(255, 77, 109, 0.12); border: 1.5px solid #ff4d6d; border-radius: 12px; padding: 12px; margin: 12px 0; text-align: left; font-size: 11px; line-height: 1.45; color: #cbd5e1;">
          <div style="font-weight: 800; color: #ff4d6d; margin-bottom: 4px;">ПРИЧИНА ДИСКВАЛИФИКАЦИИ:</div>
          <div>${reason}</div>
          <div style="margin-top: 8px; color: #fff;">
            Вы исчерпали лимит ошибок в официальном турнирном квесте «Машина времени». Прохождение этой карточки заблокировано.
          </div>
        </div>

        <div style="background: rgba(245,197,66,0.08); border: 1px dashed var(--accent-gold); border-radius: 8px; padding: 10px; font-size: 11px; color: #cbd5e1; margin-bottom: 14px; text-align: left;">
          📜 <b>СУДЕЙСКИЙ РЕГЛАМЕНТ:</b><br>
          • Вы можете продолжать сражаться в свободных дуэлях (кнопка «Дуэль») и общаться с AI.<br>
          • Если судья турнира разрешит пересдачу, судья вводит мастер-код разблокировки.
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <input type="password" id="tm-judge-pin" placeholder="ПИН-код судьи для сброса..." style="padding:8px 10px; border-radius:6px; background:#0c121e; border:1px solid rgba(255,255,255,0.2); color:#fff; font-size:11px; text-align:center; outline:none;">
          <button class="tm-action-btn" id="btn-judge-reset" style="background: rgba(255,255,255,0.12); color:#fff; border:1px solid var(--accent-gold);">
            СУДЕЙСКИЙ СБРОС (КОД: 2026)
          </button>
          <button class="tm-action-btn" id="btn-close-gameover" style="background: #2a354f; color:#94a3b8;">
            Закрыть портал
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-close-gameover')?.addEventListener('click', () => {
      if (this.onFinish) this.onFinish();
    });

    document.getElementById('btn-judge-reset')?.addEventListener('click', () => {
      const pin = document.getElementById('tm-judge-pin')?.value.trim();
      if (pin === "2026" || pin === "kvantorium") {
        try { localStorage.removeItem(this.getStorageKey()); } catch (e) {}
        this.lives = this.maxLives;
        this.updateLivesUI(false);
        chronoSfx.warpSound();
        this.currentBioIdx = 0;
        this.currentTacIdx = 0;
        this.currentDuelTier = 0;
        this.renderPrologue();
      } else {
        alert("Неверный код судьи! Обратитесь к организаторам турнира.");
      }
    });
  }

  updateDuelHpBars() {
    const eBar = document.getElementById('enemy-hp-bar');
    const eNum = document.getElementById('enemy-hp-num');
    const pBar = document.getElementById('player-hp-bar');
    const pNum = document.getElementById('player-hp-num');

    if (eBar) eBar.style.width = `${Math.round((this.enemyHp / this.enemyMaxHp) * 100)}%`;
    if (eNum) eNum.innerText = `${this.enemyHp}/${this.enemyMaxHp}`;
    if (pBar) pBar.style.width = `${Math.round((this.playerHp / 30) * 100)}%`;
    if (pNum) pNum.innerText = `${this.playerHp}/30`;
  }

  // ================= 4. ФИНАЛЬНЫЙ БОСС: ХРАНИТЕЛЬ ВРЕМЕНИ НА LICHESS =================
  renderLichessBossIntro() {
    this.updatePips('lichess');
    chronoSfx.warpSound();

    this.elements.body.innerHTML = `
      <div class="boss-arena-card">
        <div style="text-align: center; margin-bottom: 12px;">
          <div style="font-size: 38px; color: var(--accent-gold); margin-bottom: 4px;">⌛♚⌛</div>
          <div class="tm-title" style="color: var(--accent-gold); font-size: 16px;">ФИНАЛ: ХРАНИТЕЛЬ ВРЕМЕНИ</div>
          <div class="tm-subtitle">БИТВА С БОТОМ ТУРНИРА НА LICHESS.ORG</div>
        </div>

        <div class="tm-story-scroll" style="max-height: 180px;">
          <p>
            ТЫ ДОКАЗАЛ СВОЁ ПРАВО БЫТЬ <b>${this.hero.name.toUpperCase()}</b>! Ты безупречно вспомнил все 7 фактов биографии, решил 3 тактики и одолел 3 соперников!
          </p>
          <p style="margin-top: 6px; color: #ff4d6d;">
            Последний рубеж квантового барьера защищает <strong>Хранитель Времени</strong> — официальный бот турнира в Кванториуме!
          </p>
          <p style="margin-top: 6px; color: var(--neon-cyan);">
            🎁 <strong>СУПЕРПРИЗ КВАНТОРИУМА:</strong><br>
            <b>Первые 3 участника</b>, которые завершат партию с ботом на Lichess и предъявят сертификат главному судье, получат ценные награды!
          </p>
        </div>

        <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(245,197,66,0.3); border-radius: 12px; padding: 12px; margin: 10px 0;">
          <div style="font-size: 11px; font-weight: 800; color: var(--accent-gold); margin-bottom: 6px;">
            ШАГ 1: ВЫЗОВ БОТА НА ПАРТИЮ
          </div>
          <a href="${TOURNAMENT_CONFIG.lichessBotUrl}" target="_blank" class="tm-action-btn" style="text-decoration:none; margin: 0 0 10px; padding: 10px; font-size: 11px; background: linear-gradient(135deg, #38bdf8 0%, #1e40af 100%); color: #fff;">
            🌐 Открыть бота @${TOURNAMENT_CONFIG.lichessBotName} на Lichess
          </a>

          <div style="font-size: 11px; font-weight: 800; color: var(--accent-gold); margin-bottom: 4px;">
            ШАГ 2: ВВЕДИТЕ ВАШ НИКНЕЙМ НА LICHESS
          </div>
          <input type="text" id="lichess-player-input" placeholder="Ваш никнейм на Lichess..." style="width: 100%; background: #0c121e; border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: #fff; padding: 8px 10px; font-size: 11px; margin-bottom: 8px; outline: none;">
          
          <button class="tm-action-btn" id="btn-verify-lichess" style="background: var(--accent-gold); color: #000; padding: 10px; font-size: 11px;">
            <span>ПОДТВЕРДИТЬ И ПОЛУЧИТЬ СЕРТИФИКАТ ➔</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-verify-lichess')?.addEventListener('click', () => {
      const input = document.getElementById('lichess-player-input');
      const val = input ? input.value.trim() : "";
      if (!val) {
        alert("Пожалуйста, введите ваш ник на Lichess для фиксации времени судейской коллегией Кванториума!");
        return;
      }
      this.playerLichessNick = val;
      this.renderTournamentPrizeVictory();
    });
  }

  // ================= 5. ТРИУМФ: СЕРТИФИКАТ ПРИЗЕРА ТОП-3 =================
  renderTournamentPrizeVictory() {
    this.updatePips('victory');
    chronoSfx.fanfareSound();

    const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const verifyCode = `QT-${Math.floor(1000 + Math.random() * 9000)}-${this.hero.id.toUpperCase().substring(0,3)}`;

    this.elements.body.innerHTML = `
      <div class="tm-victory-box">
        <div class="victory-crown-icon">🏆</div>
        <div class="tm-title" style="color: #2ecc71; font-size: 16px;">ТИАСОЛЮТНЫЙ ТРИУМФ!</div>
        <div class="tm-subtitle">ТЫ ДОКАЗАЛ, ЧТО ТЫ — ${this.hero.name.toUpperCase()}!</div>

        <div class="seal-stamp" style="border-color: #2ecc71; background: rgba(46, 204, 113, 0.08);">
          <div class="seal-title" style="color: #2ecc71;">СЕРТИФИКАТ ФИНАЛИСТА ТУРНИРА ТОП-3</div>
          <div class="seal-champ">${this.hero.name}</div>
          <div style="font-size: 11px; color: #fff; margin: 4px 0;">Игрок: <b>${this.playerLichessNick}</b></div>
          <div class="seal-sub">Время финиша: ${timestamp} • Код: <b style="color:var(--accent-gold);">${verifyCode}</b></div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 6px;">Кванториум • Улан-Удэ • 21-22 ноября</div>
        </div>

        <div style="background: rgba(245,197,66,0.1); border: 1px solid var(--accent-gold); border-radius: 8px; padding: 10px; font-size: 11px; line-height: 1.4; color: #e2e8f0; margin-bottom: 12px; text-align: left;">
          🏃 <strong>ПОКАЖИТЕ ЭТОТ ЭКРАН СУДЬЕ ПРЯМО СЕЙЧАС!</strong><br>
          Первые 3 участника, предъявившие сертификат с верификационным кодом <b>${verifyCode}</b>, получают суперприз турнира!
        </div>

        <button class="tm-action-btn" id="btn-finish-all" style="background: var(--accent-gold); color: #000; font-weight: 800;">
          <span>ВЕРНУТЬСЯ К КАРТОЧКЕ AR</span>
        </button>
      </div>
    `;

    document.getElementById('btn-finish-all')?.addEventListener('click', () => {
      if (this.onFinish) this.onFinish();
    });
  }
}