// ==========================================
// 0. ЭКРАННЫЙ ЛОГГЕР (DEBUG ON-SCREEN CONSOLE)
// ==========================================
const debugConsole = document.createElement('div');
debugConsole.id = 'ar-debug-console';
debugConsole.style.cssText = `
  position: fixed;
  top: 10px;
  left: 10px;
  right: 10px;
  max-height: 180px;
  overflow-y: auto;
  background: rgba(0, 0, 0, 0.85);
  color: #00ffcc;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.3;
  padding: 8px;
  border-radius: 6px;
  z-index: 99999;
  border: 1px solid #00ffcc;
  pointer-events: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
`;
document.body.appendChild(debugConsole);

function logMsg(msg, color = '#00ffcc') {
  const line = document.createElement('div');
  line.style.color = color;
  line.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
  line.style.padding = '2px 0';
  const time = new Date().toTimeString().split(' ')[0].substring(3);
  line.innerText = `[${time}] ${msg}`;
  debugConsole.appendChild(line);
  debugConsole.scrollTop = debugConsole.scrollHeight;
  console.log(`[AR_LOG] ${msg}`);
}

logMsg("🚀 Инициализация скрипта app.js...");

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
    logMsg("DOM загружен. Ожидание a-scene...");
    if (percentText) percentText.innerText = "Инициализация сцены...";
    if (barFill) barFill.style.width = "25%";

    if (!sceneEl.hasLoaded) {
      await new Promise(res => sceneEl.addEventListener('loaded', res, { once: true }));
    }
    logMsg("a-scene загружена успешно.");

    if (percentText) percentText.innerText = "Запуск MindAR и камеры...";
    if (barFill) barFill.style.width = "50%";

    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) {
      throw new Error("MindAR система не найдена на сцене!");
    }

    logMsg("Старт системы MindAR...");
    await arSystem.start();
    logMsg("MindAR успешно запущен!", "#2ecc71");

    // Диагностика скомпилированного .mind файла
    if (arSystem.controller && arSystem.controller.inputImageTargetList) {
      const targetsLoaded = arSystem.controller.inputImageTargetList.length;
      logMsg(`Файл cards.mind загружен. Таргетов в базе: ${targetsLoaded}`, "#f1c40f");
      if (targetsLoaded < 18) {
        logMsg(`ВНИМАНИЕ! В файле ${targetsLoaded} таргетов, а в коде ожидается 18!`, "#ff4d6d");
      }
    }

    if (barFill) barFill.style.width = "100%";
    if (percentText) percentText.innerText = "Готово!";

    setTimeout(() => {
      if (loadBox) loadBox.style.display = "none";
      if (readySub) readySub.style.display = "block";
      if (badge) {
        badge.innerText = "СКАНЕР АКТИВЕН";
        badge.style.borderColor = "var(--accent-color)";
        badge.style.color = "var(--accent-color)";
      }
      if (title) title.innerText = "НАВЕДИТЕ НА КАРТОЧКУ";
    }, 200);

  } catch (err) {
    logMsg(`КРИТИЧЕСКАЯ ОШИБКА: ${err.message}`, "#ff4d6d");
    console.error("Ошибка инициализации AR:", err);
    if (badge) {
      badge.innerText = "ОШИБКА";
      badge.style.borderColor = "#ff4d6d";
      badge.style.color = "#ff4d6d";
    }
    if (title) title.innerText = "СБОЙ ЗАПУСКА";
    if (percentText) percentText.innerText = err.message || "Ошибка камеры/таргетов";
    if (barFill) barFill.style.background = "#ff4d6d";
  }

  sceneEl.addEventListener("arError", (ev) => {
    logMsg(`Событие arError: ${JSON.stringify(ev.detail || ev)}`, "#ff4d6d");
    if (badge) {
      badge.innerText = "ОШИБКА КАМЕРЫ";
      badge.style.borderColor = "#ff4d6d";
      badge.style.color = "#ff4d6d";
    }
  });

  if (typeof updatePassportCounter === "function") {
    updatePassportCounter();
  }
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
const ALL_TARGET_IDS = Array.from({ length: 18 }, (_, i) => i);

// ==========================================
// 3. РАЗБЛОКИРОВКА АВТОПРОИГРЫВАНИЯ
// ==========================================
function handleFirstInteraction() {
  if (userHasInteracted) return;
  userHasInteracted = true;
  logMsg("Тап по экрану: медиа-контекст разблокирован");

  if (typeof sfx !== "undefined" && sfx.ctx && sfx.ctx.state === "suspended") {
    sfx.ctx.resume();
  }

  if (currentHeroId !== null) {
    playTargetVideo(currentHeroId);
  }
}

document.addEventListener("touchstart", handleFirstInteraction, { once: true, passive: true });
document.addEventListener("click", handleFirstInteraction, { once: true });

// ==========================================
// 4. УПРАВЛЕНИЕ ВИДЕО
// ==========================================
function playTargetVideo(id) {
  const vid = document.getElementById(`vid-${id}`);
  if (!vid) {
    logMsg(`Элемент #vid-${id} не найден в DOM!`, "#ff4d6d");
    return;
  }

  logMsg(`Попытка пуска #vid-${id} (muted=${isMuted})`);
  vid.muted = isMuted;
  vid.defaultMuted = isMuted;
  vid.playsInline = true;

  if (vid.readyState === 0) {
    logMsg(`Подгрузка #vid-${id}...`);
    vid.load();
  }

  const playPromise = vid.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      logMsg(`▶ Видео #vid-${id} успешно играет!`, "#2ecc71");
    }).catch(err => {
      logMsg(`⚠ Автоплей со звуком заблокирован: ${err.name}. Пробуем muted...`, "#f1c40f");
      vid.muted = true;
      isMuted = true;
      if (soundBtn) soundBtn.innerHTML = "<span>🔇</span> ЗВУК: ВЫКЛ";
      vid.play()
        .then(() => logMsg(`▶ Видео #vid-${id} запущено в MUTED режиме!`, "#2ecc71"))
        .catch(e => logMsg(`❌ Ошибка даже в muted: ${e.message}`, "#ff4d6d"));
    });
  }
}

function stopTargetVideo(id) {
  const vid = document.getElementById(`vid-${id}`);
  if (vid) {
    vid.pause();
    vid.currentTime = 0;
  }
}

// ==========================================
// 5. ДИАГНОСТИЧЕСКИЕ СЛУШАТЕЛИ ТАРГЕТОВ
// ==========================================
ALL_TARGET_IDS.forEach(id => {
  const targetEl = document.getElementById(`target-${id}`);
  const videoEl = document.getElementById(`vid-${id}`);

  if (!targetEl) {
    logMsg(`Тег #target-${id} отсутствует в HTML!`, "#ff4d6d");
    return;
  }

  if (videoEl) {
    videoEl.addEventListener('error', () => {
      const err = videoEl.error;
      logMsg(`❌ Ошибка видеофайла #vid-${id}: code ${err ? err.code : 'unknown'}`, "#ff4d6d");
    });
  }

  targetEl.addEventListener("targetFound", () => {
    logMsg(`🎯 ТАРГЕТ #${id} НАЙДЕН В КАДРЕ!`, "#2ecc71");

    if (typeof sfx !== "undefined" && sfx.playTargetFound) sfx.playTargetFound();
    if (hint) hint.classList.add("hidden");
    if (dock) dock.style.display = "flex";
    if (soundBtn) soundBtn.style.display = "inline-flex";

    if (id === SCHOOL_TARGET_ID) {
      currentHeroId = null;
      showSchoolUI();
    } else if (typeof HEROES !== "undefined" && HEROES[id]) {
      currentHeroId = id;
      applyHeroTheme(HEROES[id]);
      showChampionUI();
    } else {
      logMsg(`Предупреждение: HEROES[${id}] не описан в heroes-data.js`, "#f1c40f");
    }

    playTargetVideo(id);
  });

  targetEl.addEventListener("targetLost", () => {
    logMsg(`Таргет #${id} потерян из вида`, "#888");
    stopTargetVideo(id);
  });
});

// ==========================================
// 6. ТЕМЫ И ЗВУК
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
    if (isEnabled && typeof sfx !== "undefined" && sfx.playMove) {
      sfx.playMove();
    }
  });
}

// ==========================================
// 7. МОДАЛЬНЫЕ ОКНА
// ==========================================
function openModal(type) {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  if (currentHeroId === null || typeof HEROES === "undefined") return;
  const hero = HEROES[currentHeroId];

  const activeVideo = document.getElementById(`vid-${currentHeroId}`);
  if (activeVideo) activeVideo.pause();

  if (navigator.vibrate) navigator.vibrate(35);

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

function showSchoolUI() {
  document.documentElement.style.setProperty('--accent-color', '#00e5ff');
  document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 229, 255, 0.4)');

  if (!dock) return;
  dock.style.display = "flex";
  dock.innerHTML = `
    <a class="dock-btn" href="https://tacticusfinch.ru/" target="_blank" onclick="if(typeof sfx!=='undefined'&&sfx.playMove)sfx.playMove()">
      <span>Сайт школы</span>
    </a>
    <a class="dock-btn" href="https://max.ru/se14097294_bot" target="_blank" onclick="if(typeof sfx!=='undefined'&&sfx.playMove)sfx.playMove()" style="border-color: #00ffcc; box-shadow: 0 0 15px rgba(0,255,204,0.4);">
      <span style="color: #00ffcc;">Запись (Бот)</span>
    </a>
    <button class="dock-btn" onclick="openSchoolModal()">
      <span>Реквизиты</span>
    </button>
  `;
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
    <button class="dock-btn" onclick="if(typeof startHotseatDuel==='function')startHotseatDuel()" style="border-color: #ff0055; box-shadow: 0 0 15px rgba(255,0,85,0.4);">
      <span style="color: #ff0055;">Дуэль</span>
    </button>
  `;
}

function openSchoolModal() {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  const vidSchool = document.getElementById(`vid-${SCHOOL_TARGET_ID}`);
  if (vidSchool) vidSchool.pause();

  modalContent.innerHTML = `
    <div class="modal-title">Тактикус Финч</div>
    <div class="modal-subtitle">Шахматная школа нового поколения</div>
    <div class="skill-box" style="margin-top: 10px;">
      <div style="font-size: 12px; line-height: 1.6; color: #ddd;">
        <b>Обучение:</b> Индивидуально и в мини-группах<br>
        <b>Цель:</b> Логика, концентрация и турнирный рост<br>
        <b>Формат:</b> Онлайн по всему миру + очные клубы
      </div>
    </div>
    <div class="bio-section-title">Контакты</div>
    <div class="bio-paragraph" style="font-size: 12px; color: #aaa;">
      Официальный сайт: <a href="https://tacticusfinch.ru/" target="_blank" style="color: var(--accent-color);">tacticusfinch.ru</a><br>
      Бот записи в Telegram: @se14097294_bot
    </div>
    <a href="https://max.ru/se14097294_bot" target="_blank" class="action-link-btn" style="margin-top: 14px;">
      Записаться на пробный урок
    </a>
  `;
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

// ==========================================
// 8. ВИКТОРИНЫ
// ==========================================
function renderPuzzleQuestion() {
  const hero = HEROES[currentHeroId];
  const p = hero.puzzles[currentPuzzleIndex];

  if (!p._shuffledOptions) {
    p._shuffledOptions = [...p.options].sort(() => Math.random() - 0.5);
  }
  const currentOptions = p._shuffledOptions;

  const diagramHtml = p.image
    ? `<div class="diagram-container">
        <img class="diagram-img" src="${p.image}" alt="Шахматная диаграмма" onerror="this.style.display='none'">
       </div>`
    : '';

  modalContent.innerHTML = `
    <div class="modal-title">Экзамен чемпиона</div>
    <div class="modal-subtitle">${hero.name} — Вопрос ${currentPuzzleIndex + 1} из ${hero.puzzles.length}</div>
    <div class="difficulty-badge">${p.difficulty}</div>
    <div style="font-size: 13px; color: #ccc; line-height: 1.45; margin-bottom: 8px;">${p.desc}</div>
    ${diagramHtml}
    <div id="puzzle-feedback" style="display:none; font-size: 12px; line-height: 1.4; margin: 10px 0; padding: 10px; border-radius: 8px;"></div>
    <div id="puzzle-options">
      ${currentOptions.map((opt, i) => `
        <button class="puzzle-option-btn" onclick="checkAnswer(${i})">
          ${opt.text}
        </button>
      `).join('')}
    </div>
    <div id="puzzle-next-container" style="display:none; margin-top: 10px;">
      <button class="action-link-btn" style="border:none;" onclick="nextPuzzle()">
        ${currentPuzzleIndex + 1 < hero.puzzles.length ? 'Следующий вопрос →' : 'Посмотреть результат 🏆'}
      </button>
    </div>
  `;
}

function checkAnswer(index) {
  const hero = HEROES[currentHeroId];
  const p = hero.puzzles[currentPuzzleIndex];
  const opt = (p._shuffledOptions || p.options)[index];
  
  const fb = document.getElementById("puzzle-feedback");
  const nextContainer = document.getElementById("puzzle-next-container");
  const optionsContainer = document.getElementById("puzzle-options");

  const buttons = optionsContainer.getElementsByTagName("button");
  for (let btn of buttons) {
    btn.disabled = true;
    btn.style.opacity = "0.6";
    btn.style.cursor = "default";
  }

  fb.style.display = "block";

  if (opt.correct) {
    if (typeof sfx !== "undefined" && sfx.playCorrect) sfx.playCorrect();
    testScore++;
    if (navigator.vibrate) navigator.vibrate([70, 50, 70]);
    fb.style.background = "rgba(46, 204, 113, 0.2)";
    fb.style.color = "#2ecc71";
    fb.style.border = "1px solid #2ecc71";
    fb.innerHTML = `<b>ВЕРНО!</b> ${opt.comment}`;
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    if (navigator.vibrate) navigator.vibrate(180);
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

  let evaluation = "";

  if (isPassed) {
    if (typeof sfx !== "undefined" && sfx.playFanfare) sfx.playFanfare();
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 250]);
    if (typeof registerCardDiscovery === "function") registerCardDiscovery(currentHeroId);
    if (typeof registerTestPassed === "function") registerTestPassed(currentHeroId);

    if (testScore === hero.puzzles.length) {
      evaluation = `🏆 <b>Абсолютный триумф!</b><br>${hero.name} признал ваше мастерство и добавлен в Паспорт!`;
    } else {
      evaluation = `🎉 <b>Экзамен успешно сдан!</b><br>Отличная тактика. ${hero.name} открыт в вашей Коллекции!`;
    }
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    evaluation = `❌ <b>Экзамен не сдан.</b><br>Для зачета нужно набрать минимум <b>${passThreshold} из ${hero.puzzles.length}</b>.<br>Изучите биографию и попробуйте снова!`;
  }

  const resultColor = isPassed ? "var(--accent-color)" : "#ff4d6d";

  modalContent.innerHTML = `
    <div class="modal-title">${isPassed ? 'Экзамен пройден!' : 'Экзамен не сдан'}</div>
    <div class="modal-subtitle">${hero.name}</div>
    <div style="margin: 16px 0; padding: 18px; background: rgba(255, 255, 255, 0.04); border-radius: 12px; text-align: center; border: 1.5px solid ${resultColor}; box-shadow: 0 0 15px ${isPassed ? 'var(--accent-glow)' : 'rgba(255, 77, 109, 0.2)'};">
      <div style="font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px;">Ваш результат:</div>
      <div style="font-size: 34px; font-weight: 800; color: ${resultColor}; margin: 6px 0;">${testScore} из ${hero.puzzles.length}</div>
      <div style="font-size: 13px; color: #ddd; line-height: 1.45;">${evaluation}</div>
    </div>

    ${!isPassed ? `
      <button class="action-link-btn" style="background: rgba(255,255,255,0.08); border: 1px solid var(--accent-color); color: #fff; margin-bottom: 8px;" onclick="openModal('bio')">
        📖 Изучить биографию ${hero.name.split(' ')[0]}
      </button>
    ` : ''}

    <button class="action-link-btn secondary" style="width: 100%; margin-top: 10px; cursor: pointer;" onclick="openModal('test')">
      ${isPassed ? 'Пройти еще раз' : 'Попробовать снова 🔄'}
    </button>
  `;
}