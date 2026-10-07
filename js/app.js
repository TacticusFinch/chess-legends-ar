// ==========================================
// 1. ЧЕСТНАЯ ИНИЦИАЛИЗАЦИЯ И СТАРТ AR ДВИЖКА
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

    if (percentText) percentText.innerText = "Загрузка базы cards.mind...";
    if (barFill) barFill.style.width = "60%";

    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) {
      throw new Error("MindAR система не найдена на сцене");
    }

    // Слушаем реальную готовность таргетов от самого движка MindAR
    const onARReady = new Promise((resolve, reject) => {
      sceneEl.addEventListener("arReady", () => resolve(), { once: true });
      sceneEl.addEventListener("arError", (err) => reject(err), { once: true });
    });

    // Запускаем камеру и чтение файла таргетов
    await arSystem.start();

    // ЖДЕМ, пока браузер действительно скачает и скомпилирует cards.mind
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
    if (barFill) barFill.style.background = "#ff4d6d";
  }

  sceneEl.addEventListener("arError", () => {
    if (badge) {
      badge.innerText = "ДОСТУП ЗАПРЕЩЕН";
      badge.style.borderColor = "#ff4d6d";
      badge.style.color = "#ff4d6d";
    }
    if (title) title.innerText = "КАМЕРА ЗАНЯТА";
    if (percentText) percentText.innerText = "Закройте дубликаты вкладки и разрешите камеру";
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
const ALL_TARGET_IDS = typeof HEROES !== "undefined"
  ? [...Object.keys(HEROES).map(Number), SCHOOL_TARGET_ID]
  : Array.from({ length: 18 }, (_, i) => i);

// ==========================================
// 3. РАЗБЛОКИРОВКА АУДИОКОНТЕКСТА (ЖЕСТ ПОЛЬЗОВАТЕЛЯ)
// ==========================================
function handleFirstInteraction() {
  if (userHasInteracted) return;
  userHasInteracted = true;

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
// 4. ЖЕСТКОЕ УПРАВЛЕНИЕ ВИДЕО (ИСКЛЮЧАЕТ НАЛОЖЕНИЕ)
// ==========================================

// Глобальная функция остановки ВСЕХ видео, кроме текущего
function stopAllVideosExcept(activeId = null) {
  ALL_TARGET_IDS.forEach(id => {
    if (id !== activeId) {
      const vid = document.getElementById(`vid-${id}`);
      const targetEl = document.getElementById(`target-${id}`);

      // 1. Моментально глушим звук и останавливаем поток
      if (vid) {
        vid.pause();
        vid.currentTime = 0;
        // Удаляем висящий слушатель, если видео не успело открыться
        if (vid._revealHandler) {
          vid.removeEventListener('timeupdate', vid._revealHandler);
          vid._revealHandler = null;
        }
      }

      // 2. Мгновенно убираем 3D-плоскость из рендера
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
  // ПЕРВЫМ ДЕЛОМ глушим абсолютно все остальные видео на сцене
  stopAllVideosExcept(id);

  const vid = document.getElementById(`vid-${id}`);
  const targetEl = document.getElementById(`target-${id}`);
  if (!vid || !targetEl) return;

  const aVideo = targetEl.querySelector('a-video');

  vid.muted = isMuted;
  vid.defaultMuted = isMuted;
  vid.playsInline = true;

  // Очищаем старый обработчик, если был
  if (vid._revealHandler) {
    vid.removeEventListener('timeupdate', vid._revealHandler);
  }

  // Новый обработчик показа первого кадра
  vid._revealHandler = () => {
    // Показываем видео ТОЛЬКО если этот таргет до сих пор является активным!
    if (aVideo && vid.currentTime > 0 && currentHeroId === id) {
      aVideo.setAttribute('scale', '1 1 1');
      aVideo.setAttribute('material', 'transparent: false; opacity: 1;');
      vid.removeEventListener('timeupdate', vid._revealHandler);
      vid._revealHandler = null;
    }
  };

  vid.addEventListener('timeupdate', vid._revealHandler);

  if (vid.readyState === 0) {
    vid.load();
  }

  const playPromise = vid.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      vid.muted = true;
      isMuted = true;
      if (soundBtn) soundBtn.innerHTML = "<span>🔇</span> ЗВУК: ВЫКЛ";
      vid.play().catch(() => {});
    });
  }
}

function stopTargetVideo(id) {
  const vid = document.getElementById(`vid-${id}`);
  const targetEl = document.getElementById(`target-${id}`);

  if (vid && vid._revealHandler) {
    vid.removeEventListener('timeupdate', vid._revealHandler);
    vid._revealHandler = null;
  }

  if (targetEl) {
    const aVideo = targetEl.querySelector('a-video');
    if (aVideo) {
      aVideo.setAttribute('scale', '0 0 0');
      aVideo.setAttribute('material', 'transparent: true; opacity: 0;');
    }
  }

  if (vid) {
    vid.pause();
    vid.currentTime = 0;
  }
}

// ==========================================
// 5. СЛУШАТЕЛИ ТАРГЕТОВ
// ==========================================
ALL_TARGET_IDS.forEach(id => {
  const targetEl = document.getElementById(`target-${id}`);
  if (!targetEl) return;

  targetEl.addEventListener("targetFound", () => {
    // Запоминаем текущий ID до старта видео
    currentHeroId = (id === SCHOOL_TARGET_ID) ? null : id;

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

    // Запускаем только одно видео, жестко погасив все остальные
    playTargetVideo(id);
  });

  targetEl.addEventListener("targetLost", () => {
    stopTargetVideo(id);
    if (currentHeroId === id) {
      currentHeroId = null;
    }
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
// 7. МОДАЛЬНЫЕ ОКНА И МЕНЮ
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
  } else if (type === 'stats') {
    modalContent.innerHTML = `
      <div class="modal-title">Характеристики</div>
      <div class="modal-subtitle">${hero.name}</div>
      ${hero.stats.map(s => `
        <div class="stat-row">
          <div class="stat-header"><span>${s.name}</span><span>${s.val}%</span></div>
          <div class="stat-track"><div class="stat-fill" style="width: ${s.val}%"></div></div>
        </div>
      `).join('')}
      <div class="skill-box">
        <div style="font-size: 11px; color: var(--accent-color); font-weight: 700; text-transform: uppercase;">Ключевой навык:</div>
        <div style="font-size: 14px; font-weight: bold; margin-top: 3px;">${hero.skillName}</div>
        <div style="font-size: 12px; color: #aaa; margin-top: 5px; line-height: 1.4;">${hero.skillDesc}</div>
      </div>
      <div class="external-promo-box">
        <div style="font-size: 12px; font-weight: 600;">Хотите записаться на занятия?</div>
        <div style="font-size: 11px; color: #aaa; margin-top: 3px;">Узнайте расписание и подробности о школе:</div>
        <a href="https://max.ru/se14097294_bot" target="_blank" class="action-link-btn">
          🤖 Тактикус Финч
        </a>
        <a href="https://tacticusfinch.ru/" target="_blank" class="action-link-btn">
          Официальный сайт шахматной школы
        </a>
      </div>
    `;
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
// 8. ВИКТОРИНЫ И ТЕСТЫ
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

    <div class="external-promo-box">
      <div style="font-size: 12px; font-weight: 700; margin-bottom: 2px;">Шахматная школа</div>
      <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Запись на занятия и информация:</div>
      <a href="https://max.ru/se14097294_bot" target="_blank" class="action-link-btn">
        🤖 Записаться на занятия (Бот Финч)
      </a>
      <a href="https://lichess.org/learn" target="_blank" class="action-link-btn secondary" style="margin-top: 6px;">
        Изучить базовые механики
      </a>
    </div>

    <button class="action-link-btn secondary" style="width: 100%; margin-top: 10px; cursor: pointer;" onclick="openModal('test')">
      ${isPassed ? 'Пройти еще раз' : 'Попробовать снова 🔄'}
    </button>
  `;
}