// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И СТАРТ AR ДВИЖКА
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  const sceneEl = document.querySelector('a-scene');
  const barFill = document.getElementById('load-bar-fill');
  const percentText = document.getElementById('load-percent');
  const loadBox = document.getElementById('load-progress-container');
  const badge = document.getElementById('loading-badge');
  const title = document.getElementById('loading-title');
  const readySub = document.getElementById('ready-status-sub');

  try {
    if (percentText) percentText.innerText = "Подключение A-Frame...";
    if (barFill) barFill.style.width = "25%";

    if (!sceneEl.hasLoaded) {
      await new Promise(res => sceneEl.addEventListener('loaded', res, { once: true }));
    }

    if (percentText) percentText.innerText = "Загрузка базы героев...";
    if (barFill) barFill.style.width = "60%";

    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) throw new Error("MindAR система не найдена");

    const onARReady = new Promise((resolve, reject) => {
      sceneEl.addEventListener("arReady", () => resolve(), { once: true });
      sceneEl.addEventListener("arError", (err) => reject(err), { once: true });
    });

    await arSystem.start();
    await onARReady;

    if (barFill) barFill.style.width = "100%";
    if (percentText) percentText.innerText = "Готово!";

    setTimeout(() => {
      if (loadBox) loadBox.style.display = "none";
      if (readySub) readySub.style.display = "block";
      if (badge) {
        badge.innerText = "AR СКАНЕР АКТИВЕН";
        badge.style.borderColor = "var(--accent-color)";
        badge.style.color = "var(--accent-color)";
      }
      if (title) title.innerText = "НАВЕДИТЕ НА КАРТОЧКУ";
    }, 250);

  } catch (err) {
    console.error("Ошибка инициализации AR:", err);
    if (badge) {
      badge.innerText = "ОШИБКА";
      badge.style.borderColor = "#ff4d6d";
      badge.style.color = "#ff4d6d";
    }
    if (title) title.innerText = "СБОЙ КАМЕРЫ";
    if (percentText) percentText.innerText = "Закройте другие вкладки и обновите страницу";
  }

  if (typeof updatePassportCounter === "function") updatePassportCounter();
});

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ==========================================
let currentHeroId = null;
let isMuted = true;
let currentPuzzleIndex = 0;
let testScore = 0;
let userHasInteracted = false;

const hint = document.getElementById("scanner-hint");
const dock = document.getElementById("interactive-dock");
const soundBtn = document.getElementById("sound-toggle");
const modal = document.getElementById("modal-container");
const modalContent = document.getElementById("modal-content");

const SCHOOL_TARGET_ID = 17;
const ALL_TARGET_IDS = typeof HEROES !== "undefined"
  ? [...Object.keys(HEROES).map(Number), SCHOOL_TARGET_ID]
  : Array.from({ length: 18 }, (_, i) => i);

// Активация аудио-контекста первым жестом
function handleFirstInteraction() {
  if (userHasInteracted) return;
  userHasInteracted = true;
  if (typeof sfx !== "undefined" && sfx.ctx && sfx.ctx.state === "suspended") {
    sfx.ctx.resume();
  }
}
document.addEventListener("touchstart", handleFirstInteraction, { once: true, passive: true });
document.addEventListener("click", handleFirstInteraction, { once: true });

// ==========================================
// 3. УПРАВЛЕНИЕ ВИДЕО КАРТОЧЕК
// ==========================================
const visibleTargets = new Set();

function stopAllVideosExcept(activeId = null) {
  ALL_TARGET_IDS.forEach(id => {
    if (id !== activeId) {
      const vid = document.getElementById(`vid-${id}`);
      const targetEl = document.getElementById(`target-${id}`);
      if (vid) {
        vid.pause();
        vid.currentTime = 0;
      }
      if (targetEl) {
        const aVideo = targetEl.querySelector('a-video');
        if (aVideo) {
          aVideo.setAttribute('scale', '0 0 0');
          aVideo.setAttribute('material', 'transparent: true; opacity: 0;');
        }
      }
    }
  });
}

function playTargetVideo(id) {
  stopAllVideosExcept(id);
  visibleTargets.add(id);

  const vid = document.getElementById(`vid-${id}`);
  const targetEl = document.getElementById(`target-${id}`);
  if (!vid || !targetEl) return;

  const aVideo = targetEl.querySelector('a-video');
  vid.muted = isMuted;
  vid.defaultMuted = isMuted;
  vid.playsInline = true;

  vid.onplaying = () => {
    if (aVideo && visibleTargets.has(id)) {
      aVideo.setAttribute('scale', '1 1 1');
      aVideo.setAttribute('material', 'transparent: false; opacity: 1;');
    }
  };

  vid.play().catch(() => {});
}

function stopTargetVideo(id) {
  visibleTargets.delete(id);
  const vid = document.getElementById(`vid-${id}`);
  const targetEl = document.getElementById(`target-${id}`);
  if (vid) {
    vid.muted = true;
    vid.pause();
    vid.currentTime = 0;
  }
  if (targetEl) {
    const aVideo = targetEl.querySelector('a-video');
    if (aVideo) {
      aVideo.setAttribute('scale', '0 0 0');
      aVideo.setAttribute('material', 'transparent: true; opacity: 0;');
    }
  }
}

// ==========================================
// 4. СЛУШАТЕЛИ ТАРГЕТОВ AR (СВЯЗЬ С ДУЭЛЬЮ)
// ==========================================
ALL_TARGET_IDS.forEach(id => {
  const targetEl = document.getElementById(`target-${id}`);
  if (!targetEl) return;

  targetEl.addEventListener("targetFound", () => {
    currentHeroId = (id === SCHOOL_TARGET_ID) ? null : id;

    // Передаем данные чемпиона в глобальную память
    if (typeof HEROES !== "undefined" && HEROES[id]) {
      window.currentHeroData = { ...HEROES[id], id: id };
      try {
        localStorage.setItem("last_active_hero", JSON.stringify(window.currentHeroData));
      } catch (e) {}
    }

    if (typeof sfx !== "undefined" && sfx.playTargetFound) sfx.playTargetFound();

    if (hint) hint.classList.add("hidden");
    if (dock) dock.style.display = "flex";
    if (soundBtn) soundBtn.style.display = "inline-flex";

    if (id === SCHOOL_TARGET_ID) {
      showSchoolUI();
    } else if (typeof HEROES !== "undefined" && HEROES[id]) {
      applyHeroTheme(HEROES[id]);
      showChampionUI();
    }

    playTargetVideo(id);
  });

  targetEl.addEventListener("targetLost", () => {
    stopTargetVideo(id);
    // Кнопки и выбранный герой НЕ сбрасываются
  });
});

// ==========================================
// 5. ТЕМЫ, ЗВУК И ИНТЕРФЕЙС
// ==========================================
function applyHeroTheme(hero) {
  if (!hero) return;
  document.documentElement.style.setProperty('--accent-color', hero.color);
  document.documentElement.style.setProperty('--accent-glow', hero.colorGlow);
  if (soundBtn) soundBtn.style.borderColor = hero.color;
}

if (soundBtn) {
  soundBtn.addEventListener("click", () => {
    const isEnabled = (typeof sfx !== "undefined" && sfx.toggle) ? sfx.toggle() : !isMuted;
    isMuted = !isEnabled;
    const activeTargetId = currentHeroId !== null ? currentHeroId : SCHOOL_TARGET_ID;
    const vid = document.getElementById(`vid-${activeTargetId}`);
    if (vid) {
      vid.muted = isMuted;
      vid.volume = 1.0;
    }
    soundBtn.innerHTML = isEnabled ? "<span>🔊</span> ЗВУК: ВКЛ" : "<span>🔇</span> ЗВУК: ВЫКЛ";
    if (isEnabled && typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  });
}

function showChampionUI() {
  if (!dock) return;
  dock.style.display = "flex";
  dock.innerHTML = `
    <button class="dock-btn" onclick="openModal('bio')"><span>Биография</span></button>
    <button class="dock-btn" onclick="openModal('test')"><span>Тест</span></button>
    <button class="dock-btn" onclick="if(typeof openAIChatModal==='function')openAIChatModal()" style="border-color: #00e5ff; box-shadow: 0 0 15px rgba(0,229,255,0.4);">
      <span style="color: #00e5ff;">🎙️ Спроси</span>
    </button>
    <button class="dock-btn" onclick="NetDuel.openLobby()" style="border-color: #ff0055; box-shadow: 0 0 15px rgba(255,0,85,0.4);">
      <span style="color: #ff0055;">⚔️ Дуэль</span>
    </button>
  `;
}

function showSchoolUI() {
  document.documentElement.style.setProperty('--accent-color', '#00e5ff');
  document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 229, 255, 0.4)');
  if (!dock) return;
  dock.style.display = "flex";
  dock.innerHTML = `
    <a class="dock-btn" href="https://tacticusfinch.ru/" target="_blank"><span>Сайт школы</span></a>
    <a class="dock-btn" href="https://max.ru/se14097294_bot" target="_blank" style="border-color: #00ffcc;"><span style="color: #00ffcc;">Запись</span></a>
    <button class="dock-btn" onclick="openSchoolModal()"><span>Инфо</span></button>
  `;
}

// ==========================================
// 6. МОДАЛЬНЫЕ ОКНА И ВИКТОРИНЫ
// ==========================================
function openModal(type) {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  if (currentHeroId === null || typeof HEROES === "undefined") return;
  const hero = HEROES[currentHeroId];

  const activeVideo = document.getElementById(`vid-${currentHeroId}`);
  if (activeVideo) activeVideo.pause();

  if (type === 'bio') {
    modalContent.innerHTML = `
      <div class="modal-title">${hero.name}</div>
      <div class="modal-subtitle">${hero.title}</div>
      <div class="modal-quote">${hero.quote}</div>
      ${hero.bio.map(sec => `
        <div class="bio-section-title">${sec.title}</div>
        <div class="bio-paragraph">${sec.text}</div>
      `).join('')}
    `;
  } else if (type === 'test') {
    currentPuzzleIndex = 0;
    testScore = 0;
    renderPuzzleQuestion();
  }

  modal.classList.add("active");
}

function closeModal() {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  modal.classList.remove("active");
  if (currentHeroId !== null) {
    const activeVideo = document.getElementById(`vid-${currentHeroId}`);
    if (activeVideo) activeVideo.play().catch(() => {});
  }
}

function renderPuzzleQuestion() {
  const hero = HEROES[currentHeroId];
  const p = hero.puzzles[currentPuzzleIndex];

  if (!p._shuffledOptions) {
    p._shuffledOptions = [...p.options].sort(() => Math.random() - 0.5);
  }

  const diagramHtml = p.image
    ? `<div class="diagram-container"><img class="diagram-img" src="${p.image}" alt="Диаграмма"></div>`
    : '';

  modalContent.innerHTML = `
    <div class="modal-title">Экзамен чемпиона</div>
    <div class="modal-subtitle">${hero.name} — Вопрос ${currentPuzzleIndex + 1} из ${hero.puzzles.length}</div>
    <div class="difficulty-badge">${p.difficulty}</div>
    <div style="font-size: 13px; color: #ccc; margin-bottom: 8px;">${p.desc}</div>
    ${diagramHtml}
    <div id="puzzle-feedback" style="display:none; font-size: 12px; margin: 10px 0; padding: 10px; border-radius: 8px;"></div>
    <div id="puzzle-options">
      ${p._shuffledOptions.map((opt, i) => `
        <button class="puzzle-option-btn" onclick="checkAnswer(${i})">${opt.text}</button>
      `).join('')}
    </div>
    <div id="puzzle-next-container" style="display:none; margin-top: 10px;">
      <button class="action-link-btn" onclick="nextPuzzle()">
        ${currentPuzzleIndex + 1 < hero.puzzles.length ? 'Следующий вопрос →' : 'Итоги экзамена 🏆'}
      </button>
    </div>
  `;
}

function checkAnswer(index) {
  const hero = HEROES[currentHeroId];
  const p = hero.puzzles[currentPuzzleIndex];
  const opt = p._shuffledOptions[index];
  const fb = document.getElementById("puzzle-feedback");
  const nextContainer = document.getElementById("puzzle-next-container");

  const buttons = document.querySelectorAll("#puzzle-options button");
  buttons.forEach(btn => { btn.disabled = true; btn.style.opacity = "0.5"; });

  fb.style.display = "block";
  if (opt.correct) {
    if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    testScore++;
    fb.style.background = "rgba(46, 204, 113, 0.2)";
    fb.style.color = "#2ecc71";
    fb.style.border = "1px solid #2ecc71";
    fb.innerHTML = `<b>ВЕРНО!</b> ${opt.comment}`;
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    fb.style.background = "rgba(231, 76, 60, 0.2)";
    fb.style.color = "#e74c3c";
    fb.style.border = "1px solid #e74c3c";
    fb.innerHTML = `<b>НЕВЕРНО.</b> ${opt.comment}`;
  }
  nextContainer.style.display = "block";
}

function nextPuzzle() {
  currentPuzzleIndex++;
  const hero = HEROES[currentHeroId];
  if (currentPuzzleIndex < hero.puzzles.length) {
    renderPuzzleQuestion();
  } else {
    renderTestResult();
  }
}

function renderTestResult() {
  const hero = HEROES[currentHeroId];
  const passThreshold = Math.ceil(hero.puzzles.length * 0.8);
  const isPassed = testScore >= passThreshold;

  if (isPassed) {
    if (typeof sfx !== "undefined" && sfx.playFanfare) sfx.playFanfare();
    if (typeof registerCardDiscovery === "function") registerCardDiscovery(currentHeroId);
    if (typeof registerTestPassed === "function") registerTestPassed(currentHeroId);
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
  }

  const resultColor = isPassed ? "var(--accent-color)" : "#ff4d6d";

  modalContent.innerHTML = `
    <div class="modal-title">${isPassed ? 'Экзамен пройден!' : 'Экзамен не сдан'}</div>
    <div class="modal-subtitle">${hero.name}</div>
    <div style="margin: 16px 0; padding: 18px; background: rgba(255, 255, 255, 0.04); border-radius: 12px; text-align: center; border: 1.5px solid ${resultColor};">
      <div style="font-size: 32px; font-weight: 800; color: ${resultColor}; margin: 6px 0;">${testScore} из ${hero.puzzles.length}</div>
      <div style="font-size: 13px; color: #ddd;">${isPassed ? 'Герой добавлен в вашу Коллекцию!' : 'Нужно набрать минимум ' + passThreshold}</div>
    </div>
    <button class="action-link-btn secondary" onclick="openModal('test')">Пройти заново 🔄</button>
  `;
}

function openSchoolModal() {
  const vidSchool = document.getElementById(`vid-${SCHOOL_TARGET_ID}`);
  if (vidSchool) vidSchool.pause();
  modalContent.innerHTML = `
    <div class="modal-title">Тактикус Финч</div>
    <div class="modal-subtitle">Шахматная школа нового поколения</div>
    <div class="skill-box">Обучение онлайн и очные турниры по всей России.</div>
    <a href="https://tacticusfinch.ru/" target="_blank" class="action-link-btn" style="margin-top: 14px;">Перейти на сайт школы</a>
  `;
  modal.classList.add("active");
}