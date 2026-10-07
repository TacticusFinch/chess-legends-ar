document.addEventListener("DOMContentLoaded", async () => {
  const sceneEl = document.querySelector('a-scene');
  const barFill = document.getElementById('load-bar-fill');
  const percentText = document.getElementById('load-percent');
  const loadBox = document.getElementById('load-progress-container');
  const badge = document.getElementById('loading-badge');
  const title = document.getElementById('loading-title');
  const readySub = document.getElementById('ready-status-sub');

  try {
    percentText.innerText = "Инициализация движка...";
    barFill.style.width = "40%";

    if (!sceneEl.hasLoaded) {
      await new Promise(res => sceneEl.addEventListener('loaded', res, { once: true }));
    }

    percentText.innerText = "Запуск камеры и поиск целей...";
    barFill.style.width = "75%";

    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) {
      throw new Error("MindAR система не найдена");
    }

    await arSystem.start();

    barFill.style.width = "100%";
    percentText.innerText = "Готово!";

    setTimeout(() => {
      loadBox.style.display = "none";
      readySub.style.display = "block";
      badge.innerText = "AR СКАНЕР АКТИВЕН";
      badge.style.borderColor = "var(--accent-color)";
      badge.style.color = "var(--accent-color)";
      title.innerText = "НАВЕДИТЕ НА КАРТОЧКУ";
    }, 200);

  } catch (err) {
    console.error("Ошибка инициализации AR:", err);
    badge.innerText = "ОШИБКА";
    badge.style.borderColor = "#ff4d6d";
    badge.style.color = "#ff4d6d";
    title.innerText = "СБОЙ ЗАПУСКА";
    percentText.innerText = err.message || "Ошибка камеры или файла таргетов";
    barFill.style.background = "#ff4d6d";
  }

  sceneEl.addEventListener("arError", (ev) => {
    console.error("Событие arError:", ev);
    badge.innerText = "ОШИБКА КАМЕРЫ";
    badge.style.borderColor = "#ff4d6d";
    badge.style.color = "#ff4d6d";
    title.innerText = "ДОСТУП ЗАПРЕЩЕН";
    percentText.innerText = "Разрешите браузеру доступ к камере";
  });

  updatePassportCounter();
});

    let currentHeroId = null;
let isMuted = true;

// Переменные состояния теста
let currentPuzzleIndex = 0;
let testScore = 0;

const hint = document.getElementById("scanner-hint");
const dock = document.getElementById("interactive-dock");
const soundBtn = document.getElementById("sound-toggle");
const modal = document.getElementById("modal-container");
const modalContent = document.getElementById("modal-content");

// Слушатели таргетов MindAR
// Индекс общей рубашки школы
const SCHOOL_TARGET_ID = 17;

// Слушатели для всех 13 таргетов (0-11 чемпионы, 12 школа)
const ALL_TARGET_IDS = [...Object.keys(HEROES).map(Number), SCHOOL_TARGET_ID];

document.querySelectorAll('a-scene a-video').forEach(aVid => {
  aVid.setAttribute('visible', 'false');
});

// === Разогрев видео при первом касании экрана ===
let videosWarmedUp = false;

// Замените warmUpAllVideos на точечный запуск:
function playTargetVideo(id) {
  const vid = document.getElementById(`vid-${id}`);
  if (!vid) return;

  vid.muted = isMuted; // соблюдаем состояние звука
  vid.playsInline = true;
  
  const playPromise = vid.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      console.warn(`[vid-${id}] Автовоспроизведение отклонено, проигрываем muted:`, err);
      vid.muted = true;
      vid.play().catch(() => {});
    });
  }
}

document.addEventListener("touchstart", warmUpAllVideos, { once: true });
document.addEventListener("click", warmUpAllVideos, { once: true });

// === Слушатели таргетов ===
ALL_TARGET_IDS.forEach(id => {
  const targetEl = document.getElementById(`target-${id}`);
  const videoEl = document.getElementById(`vid-${id}`);
  if (!targetEl) return;

  const aVideo = targetEl.querySelector('a-video');

  // Отладочные логи для диагностики
  if (videoEl) {
    videoEl.addEventListener('error', () => console.error(`[vid-${id}] ERROR:`, videoEl.error));
    videoEl.addEventListener('playing', () => console.log(`[vid-${id}] ▶ PLAYING`));
    videoEl.addEventListener('stalled', () => console.warn(`[vid-${id}] ⏸ STALLED`));
  }

targetEl.addEventListener("targetFound", () => {
  console.warn(`!!! ТАРГЕТ ${id} ОБНАРУЖЕН КАМЕРОЙ !!!`);
  sfx.playTargetFound();
  hint.classList.add("hidden");
  dock.style.display = "flex";
  soundBtn.style.display = "inline-flex";

  if (id === SCHOOL_TARGET_ID) {
    currentHeroId = null;
    showSchoolUI();
  } else {
    currentHeroId = id;
    applyHeroTheme(HEROES[id]);
    showChampionUI();
  }

  if (aVideo) aVideo.setAttribute('visible', 'true');
  playTargetVideo(id);
});

  targetEl.addEventListener("targetLost", () => {
    if (aVideo) {
      aVideo.setAttribute('visible', 'false');
    }

    if (videoEl) {
      videoEl.pause();
      videoEl.currentTime = 0;
    }
  });
});

// Динамическая смена темы
function applyHeroTheme(hero) {
  document.documentElement.style.setProperty('--accent-color', hero.color);
  document.documentElement.style.setProperty('--accent-glow', hero.colorGlow);
  soundBtn.style.borderColor = hero.color;
}

soundBtn.addEventListener("click", () => {
  const isEnabled = sfx.toggle();
  isMuted = !isEnabled;
  
  const activeTargetId = currentHeroId !== null ? currentHeroId : SCHOOL_TARGET_ID;
  const vid = document.getElementById(`vid-${activeTargetId}`);
  if (vid) {
    vid.muted = isMuted;
    vid.volume = 1;
  }
  
  soundBtn.innerHTML = isEnabled ? "<span>🔊</span> ЗВУК: ВКЛ" : "<span>🔇</span> ЗВУК: ВЫКЛ";
  if (isEnabled) sfx.playMove();
});

// Модальные окна
function openModal(type) {
  sfx.playMove();
  if (currentHeroId === null) return;
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

// Меню для обратной стороны (Школа)
function showSchoolUI() {
  document.documentElement.style.setProperty('--accent-color', '#00e5ff');
  document.documentElement.style.setProperty('--accent-glow', 'rgba(0, 229, 255, 0.4)');

  dock.style.display = "flex";
  dock.innerHTML = `
    <a class="dock-btn" href="https://tacticusfinch.ru/" target="_blank" onclick="sfx.playMove()">
      <span>Сайт школы</span>
    </a>
    <a class="dock-btn" href="https://max.ru/se14097294_bot" target="_blank" onclick="sfx.playMove()" style="border-color: #00ffcc; box-shadow: 0 0 15px rgba(0,255,204,0.4);">
      <span style="color: #00ffcc;">Запись (Бот)</span>
    </a>
    <button class="dock-btn" onclick="openSchoolModal()">
      <span>Реквизиты</span>
    </button>
  `;
}

// Возврат стандартного меню чемпионов
function showChampionUI() {
  dock.style.display = "flex";
  dock.innerHTML = `
    <button class="dock-btn" onclick="openModal('bio')"><span>Биография</span></button>
    <button class="dock-btn" onclick="openModal('test')"><span>Тест</span></button>
    <button class="dock-btn" onclick="openAIChatModal()" style="border-color: #00e5ff; box-shadow: 0 0 15px rgba(0,229,255,0.4);">
      <span style="color: #00e5ff;">🎙️ Спроси</span>
    </button>
    <button class="dock-btn" onclick="startHotseatDuel()" style="border-color: #ff0055; box-shadow: 0 0 15px rgba(255,0,85,0.4);">
      <span style="color: #ff0055;">Дуэль</span>
    </button>
  `;
}

// Окно реквизитов школы
function openSchoolModal() {
  sfx.playMove();
  const vid12 = document.getElementById('vid-12');
  if (vid12) vid12.pause();

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

    

function renderPuzzleQuestion() {
  const hero = HEROES[currentHeroId];
  const p = hero.puzzles[currentPuzzleIndex];

  // Перемешиваем варианты случайным образом при каждом показе
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
  
  // Берем вариант именно из перемешанного списка:
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
    sfx.playCorrect();
    testScore++;
    if (navigator.vibrate) navigator.vibrate([70, 50, 70]);
    fb.style.background = "rgba(46, 204, 113, 0.2)";
    fb.style.color = "#2ecc71";
    fb.style.border = "1px solid #2ecc71";
    fb.innerHTML = `<b>ВЕРНО!</b> ${opt.comment}`;
  } else {
    sfx.playWrong();
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
  
  // Порог сдачи теста: минимум 80% правильных ответов
  // (для 7 вопросов это 6 баллов, для 3 вопросов — 3 балла)
  const passThreshold = Math.ceil(hero.puzzles.length * 0.8);
  const isPassed = testScore >= passThreshold;

  let evaluation = "";

  if (isPassed) {
    // Карточка и сдача теста засчитываются в паспорт ТОЛЬКО ПРИ ПОБЕДЕ!
    sfx.playFanfare(); // 🎺 ТРИУМФАЛЬНЫЙ ЗВУК ПОБЕДЫ!
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 250]); // Праздничная вибрация
    registerCardDiscovery(currentHeroId);
    registerTestPassed(currentHeroId);

    if (testScore === hero.puzzles.length) {
      evaluation = `🏆 <b>Абсолютный триумф!</b><br>${hero.name} безоговорочно признал ваше мастерство и добавлен в Паспорт Гроссмейстера!`;
    } else {
      evaluation = `🎉 <b>Экзамен успешно сдан!</b><br>Отличная тактика и знание истории. ${hero.name} открыт в вашей Коллекции!`;
    }
  } else {
    // Тест не сдан — карточка НЕ добавляется в коллекцию
    sfx.playWrong();
    evaluation = `❌ <b>Экзамен не сдан.</b><br>Для добавления легенды в Коллекцию нужно набрать минимум <b>${passThreshold} из ${hero.puzzles.length}</b>.<br>Изучите биографию чемпиона и попробуйте снова!`;
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
      <!-- Кнопка быстрой отправки в биографию для подготовки -->
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

function closeModal() {
  sfx.playMove();
  modal.classList.remove("active");
  if (currentHeroId !== null) {
    const activeVideo = document.getElementById(`vid-${currentHeroId}`);
    if (activeVideo) activeVideo.play().catch(() => {});
  }
}