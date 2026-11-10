// ==========================================================
// КОМПОНЕНТ ПЛАВНОЙ МАТЕРИАЛИЗАЦИИ AR (БЕЗ ЧЁРНЫХ КВАДРАТОВ)
// ==========================================================
AFRAME.registerComponent('smooth-materialize', {
  schema: {
    duration: { type: 'number', default: 500 }
  },
  init: function () {
    const el = this.el;
    const parentEntity = el.parentElement;

    // Скрываем плоскость на старте
    el.object3D.scale.set(0.001, 0.001, 0.001);
    el.object3D.visible = false;

    this.onFrameReady = () => {
      if (navigator.vibrate) navigator.vibrate(20);

      el.object3D.visible = true;
      let startTime = null;

      const animateIn = (time) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / this.data.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const curScale = 0.85 + (0.15 * ease);

        el.object3D.scale.set(curScale, curScale, curScale);

        // Безопасное изменение прозрачности без сброса текстуры видео
        const mesh = el.getObject3D('mesh');
        if (mesh && mesh.material) {
          mesh.material.transparent = true;
          mesh.material.opacity = ease;
          mesh.material.needsUpdate = true;
        }

        if (progress < 1) {
          requestAnimationFrame(animateIn);
        } else {
          el.object3D.scale.set(1, 1, 1);
          if (mesh && mesh.material) {
            mesh.material.transparent = false;
            mesh.material.opacity = 1.0;
            mesh.material.needsUpdate = true;
          }
        }
      };
      requestAnimationFrame(animateIn);
    };

    el.addEventListener('video-first-frame', this.onFrameReady);

    parentEntity.addEventListener('targetLost', () => {
      el.object3D.scale.set(0.001, 0.001, 0.001);
      el.object3D.visible = false;
    });
  }
});

// ==========================================================
// 1. КОНФИГУРАЦИЯ РАНГОВ И КОМПИЛЯЦИЙ ФАЙЛОВ .MIND
// ==========================================================
// Строгий порядок согласно компиляциям .mind файлов:
// 1. legends-1.mind (8 карт): Стейниц, Ласкер, Капабланка, Алехин, Эйве, Ботвинник, Смыслов, Таль
// 2. legends-2.mind (7 карт): Петросян, Спасский, Фишер, Карпов, Ананд, Лижэнь, Гукеш
// 3. secrets.mind   (4 карты): Стокфиш, Энигма, Каспаров, Карлсен
const RANK_CONFIGS = {
  'legends-1': {
    name: 'Легенды I',
    file: './targets/legends-1.mind',
    targets: [
      { id: 'steinitz',   globalIndex: 0,  videoId: 'vid-steinitz',   name: 'Вильгельм Стейниц' },
      { id: 'lasker',     globalIndex: 1,  videoId: 'vid-lasker',     name: 'Эммануил Ласкер' },
      { id: 'capablanca', globalIndex: 2,  videoId: 'vid-capablanca', name: 'Хосе Рауль Капабланка' },
      { id: 'alekhine',   globalIndex: 3,  videoId: 'vid-alekhine',   name: 'Александр Алехин' },
      { id: 'euwe',       globalIndex: 4,  videoId: 'vid-euwe',       name: 'Макс Эйве' },
      { id: 'botvinnik',  globalIndex: 5,  videoId: 'vid-botvinnik',  name: 'Михаил Ботвинник' },
      { id: 'smyslov',    globalIndex: 6,  videoId: 'vid-smyslov',    name: 'Василий Смыслов' },
      { id: 'tal',        globalIndex: 7,  videoId: 'vid-tal',        name: 'Михаил Таль' }
    ]
  },
  'legends-2': {
    name: 'Легенды II',
    file: './targets/legends-2.mind',
    targets: [
      { id: 'petrosyan',  globalIndex: 8,  videoId: 'vid-petrosyan',  name: 'Тигран Петросян' },
      { id: 'spassky',    globalIndex: 9,  videoId: 'vid-spassky',    name: 'Борис Спасский' },
      { id: 'fischer',    globalIndex: 10, videoId: 'vid-fischer',    name: 'Роберт Фишер' },
      { id: 'karpov',     globalIndex: 11, videoId: 'vid-karpov',     name: 'Анатолий Карпов' },
      { id: 'anand',      globalIndex: 12, videoId: 'vid-anand',      name: 'Вишванатан Ананд' },
      { id: 'liren',      globalIndex: 13, videoId: 'vid-liren',      name: 'Дин Лижэнь' },
      { id: 'gukesh',     globalIndex: 14, videoId: 'vid-gukesh',     name: 'Доммараджу Гукеш' }
    ]
  },
  'secrets': {
    name: 'Секретные',
    file: './targets/secrets.mind',
    targets: [
      { id: 'stockfish', globalIndex: 15, videoId: 'vid-stockfish', name: 'Стокфиш' },
      { id: 'enigma',    globalIndex: 16, videoId: 'vid-enigma',    name: 'Энигма' },
      { id: 'kasparov',  globalIndex: 17, videoId: 'vid-kasparov',  name: 'Гарри Каспаров' },
      { id: 'carlsen',   globalIndex: 18, videoId: 'vid-carlsen',   name: 'Магнус Карлсен' }
    ]
  }
};

let currentRankKey = 'legends-1';
let currentRankConfig = RANK_CONFIGS['legends-1'];

let currentHeroId = null;
let currentActiveTargetIndex = null;
let isMuted = true;

let currentPuzzleIndex = 0;
let testScore = 0;
let userHasInteracted = false;

const SCHOOL_TARGET_ID = 19;
const MAX_TARGET_ENTITIES = 9; // Максимальное число таргетов (0..8) в legends-1
const ALL_TARGET_INDICES = Array.from({ length: MAX_TARGET_ENTITIES }, (_, i) => i);
const visibleTargets = new Set();

let hint, dock, soundBtn, modal, modalContent;

// ==========================================
// 2. БЕЗОПАСНАЯ ИНИЦИАЛИЗАЦИЯ И СТАРТ AR ДВИЖКА
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  hint = document.getElementById("scanner-hint");
  dock = document.getElementById("interactive-dock");
  soundBtn = document.getElementById("sound-toggle");
  modal = document.getElementById("modal-container");
  modalContent = document.getElementById("modal-content");

  // 1. Считываем ранг из URL (?rank=...)
  const urlParams = new URLSearchParams(window.location.search);
  let paramRank = urlParams.get('rank');

  // Совместимость со старыми параметрами
  if (paramRank === 'legends') paramRank = 'legends-1';
  if (paramRank === 'all') paramRank = 'legends-1';

  if (paramRank && RANK_CONFIGS[paramRank]) {
    currentRankKey = paramRank;
  }
  currentRankConfig = RANK_CONFIGS[currentRankKey] || RANK_CONFIGS['legends-1'];

  // 2. Оптический лимб: окрашиваем лазер и центрируем активный пункт под визир
  document.body.setAttribute('data-active-rank', currentRankKey);

  const dialTrack = document.getElementById('dial-scroll-track');
  const dialItems = document.querySelectorAll('.dial-item');

  dialItems.forEach(item => {
    const itemRank = item.dataset.rank;
    const isCurrent = itemRank === currentRankKey;
    item.classList.toggle('active', isCurrent);

    if (isCurrent && dialTrack) {
      setTimeout(() => {
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }, 100);
    }

    item.addEventListener('click', () => {
      if (itemRank !== currentRankKey) {
        if (navigator.vibrate) navigator.vibrate(20);
        if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();

        document.body.setAttribute('data-active-rank', itemRank);
        dialItems.forEach(b => b.classList.remove('active'));
        item.classList.add('active');

        const url = new URL(window.location.href);
        url.searchParams.set('rank', itemRank);
        window.location.href = url.toString();
      }
    });
  });

  // 3. Связываем a-video с видеороликами для текущего ранга
  bindVideosForCurrentRank();

  const sceneEl = document.querySelector('a-scene');
  const barFill = document.getElementById('load-bar-fill');
  const percentText = document.getElementById('load-percent');
  const loadBox = document.getElementById('load-progress-container');
  const badge = document.getElementById('loading-badge');
  const title = document.getElementById('loading-title');
  const readySub = document.getElementById('ready-status-sub');

  // 4. Динамически назначаем целевой .mind файл для выбранного ранга
  const mindarConfig = `imageTargetSrc: ${currentRankConfig.file}; autoStart: true; maxTrack: 1; missTolerance: 1; uiLoading: no; uiScanning: no;`;
  sceneEl.setAttribute('mindar-image', mindarConfig);

  if (title) {
    title.innerText = `РАНГ: ${currentRankConfig.name.toUpperCase()}`;
  }

  try {
    if (percentText) percentText.innerText = "Подключение A-Frame...";
    if (barFill) barFill.style.width = "30%";

    if (!sceneEl.hasLoaded) {
      await new Promise(res => sceneEl.addEventListener('loaded', res, { once: true }));
    }

    if (percentText) percentText.innerText = `Загрузка: ${currentRankConfig.name}...`;
    if (barFill) barFill.style.width = "65%";

    const arSystem = sceneEl.systems["mindar-image-system"];
    if (!arSystem) {
      throw new Error("MindAR система не найдена на сцене");
    }

    // Запуск системы трекинга
    await arSystem.start();

    if (barFill) barFill.style.width = "100%";
    if (percentText) percentText.innerText = "Готово!";

    setTimeout(() => {
      if (loadBox) loadBox.style.display = "none";
      if (readySub) {
        readySub.style.display = "block";
        readySub.innerText = `${currentRankConfig.name} готовы • Наведите камеру на карту`;
      }
      
      const topHud = document.getElementById("top-hud");
      if (topHud) {
        topHud.classList.remove("preloading");
        topHud.classList.add("ready");
      }

      if (soundBtn) soundBtn.style.display = "inline-flex";

      if (badge) {
        badge.innerText = `AR СКАНЕР (${currentRankConfig.name.toUpperCase()})`;
        badge.style.borderColor = "var(--accent-color, #f1c40f)";
        badge.style.color = "var(--accent-color, #f1c40f)";
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
// 3. СВЯЗЫВАНИЕ ТАРГЕТОВ С АССЕТАМИ ВИДЕО
// ==========================================
function bindVideosForCurrentRank() {
  const targets = currentRankConfig.targets;

  ALL_TARGET_INDICES.forEach(index => {
    const targetEl = document.getElementById(`target-${index}`);
    if (!targetEl) return;

    const aVideo = targetEl.querySelector('a-video');
    if (!aVideo) return;

    if (index < targets.length) {
      const targetMeta = targets[index];
      aVideo.setAttribute('src', `#${targetMeta.videoId}`);
      targetEl.setAttribute('data-hero-id', targetMeta.id);
      targetEl.setAttribute('data-global-index', targetMeta.globalIndex);
      targetEl.style.display = '';
    } else {
      // Таргет не используется в данном ранге
      targetEl.removeAttribute('data-hero-id');
      aVideo.removeAttribute('src');
    }
  });
}

function getHeroDataForTarget(index) {
  const targets = currentRankConfig.targets;
  if (!targets || index >= targets.length) return null;

  const meta = targets[index];
  let heroObj = null;

  if (typeof HEROES !== "undefined") {
    heroObj = HEROES[meta.id] || HEROES[meta.globalIndex] || HEROES[index];
  }

  return { meta, heroObj };
}

// ==========================================
// 4. РАЗБЛОКИРОВКА АУДИОКОНТЕКСТА
// ==========================================
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
// 5. УПРАВЛЕНИЕ ВИДЕОПЛЕЕРАМИ
// ==========================================
function getVideoElementForTarget(targetIndex) {
  const targets = currentRankConfig.targets;
  if (targets && targetIndex < targets.length) {
    const vid = document.getElementById(targets[targetIndex].videoId);
    if (vid) return vid;
  }
  return document.getElementById(`vid-${targetIndex}`);
}

function stopAllVideosExcept(activeTargetIndex = null) {
  ALL_TARGET_INDICES.forEach(index => {
    if (index !== activeTargetIndex) {
      const vid = getVideoElementForTarget(index);
      const targetEl = document.getElementById(`target-${index}`);

      if (vid) {
        vid.pause();
        vid.currentTime = 0;
        if (vid._checkReadyInterval) {
          clearInterval(vid._checkReadyInterval);
          vid._checkReadyInterval = null;
        }
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

function playTargetVideo(targetIndex) {
  stopAllVideosExcept(targetIndex);
  visibleTargets.add(targetIndex);

  const vid = getVideoElementForTarget(targetIndex);
  const targetEl = document.getElementById(`target-${targetIndex}`);
  if (!vid || !targetEl) return;

  const aVideo = targetEl.querySelector('a-video');

  // Гарантируем скрытие до подтверждения отрисованного кадра
  if (aVideo) {
    aVideo.object3D.visible = false;
    const mesh = aVideo.getObject3D('mesh');
    if (mesh && mesh.material) {
      mesh.material.transparent = true;
      mesh.material.opacity = 0;
    }
  }

  vid.muted = isMuted;
  vid.defaultMuted = isMuted;
  vid.playsInline = true;

  if (vid.readyState === 0) {
    vid.load();
  }

  if (vid._checkReadyInterval) {
    clearInterval(vid._checkReadyInterval);
    vid._checkReadyInterval = null;
  }

  const triggerFirstFrame = () => {
    if (currentActiveTargetIndex === targetIndex && visibleTargets.has(targetIndex)) {
      if (aVideo) {
        aVideo.dispatchEvent(new CustomEvent('video-first-frame'));
      }
    }
  };

  // Гарантируем запуск анимации появления по первому кадру или по событию play/timeupdate
  let triggered = false;
  const safeTrigger = () => {
    if (triggered) return;
    triggered = true;
    if (vid._checkReadyInterval) {
      clearInterval(vid._checkReadyInterval);
      vid._checkReadyInterval = null;
    }
    triggerFirstFrame();
  };

  if ('requestVideoFrameCallback' in vid) {
    vid.requestVideoFrameCallback(() => {
      safeTrigger();
    });
  }

  vid._checkReadyInterval = setInterval(() => {
    const isReallyDecoded = (vid.readyState >= 2 && vid.currentTime >= 0);
    if (isReallyDecoded && currentActiveTargetIndex === targetIndex && visibleTargets.has(targetIndex)) {
      safeTrigger();
    }
  }, 50);

  // Страховочный таймаут: если видео уже декодировано или событие кадра задержалось, проявляем карточку
  setTimeout(() => {
    if (currentActiveTargetIndex === targetIndex && visibleTargets.has(targetIndex) && !vid.paused) {
      safeTrigger();
    }
  }, 400);

  const playPromise = vid.play();
  if (playPromise !== undefined) {
    playPromise.catch((e) => {
      console.warn("Автоплей заблокирован браузером, принудительный mute:", e);
      vid.muted = true;
      vid.play().then(() => safeTrigger()).catch(() => {});
    });
  }
}

function stopTargetVideo(targetIndex) {
  visibleTargets.delete(targetIndex);

  const vid = getVideoElementForTarget(targetIndex);
  const targetEl = document.getElementById(`target-${targetIndex}`);

  if (vid) {
    vid.muted = true;
    vid.pause();
    vid.currentTime = 0;
    
    if (vid._checkReadyInterval) {
      clearInterval(vid._checkReadyInterval);
      vid._checkReadyInterval = null;
    }
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
// 6. СЛУШАТЕЛИ ТАРГЕТОВ
// ==========================================
ALL_TARGET_INDICES.forEach(index => {
  const targetEl = document.getElementById(`target-${index}`);
  if (!targetEl) return;

  targetEl.addEventListener("targetFound", () => {
    const heroData = getHeroDataForTarget(index);
    if (!heroData) return;

    currentActiveTargetIndex = index;
    // Поддерживаем как строковый id, так и глобальный индекс
    currentHeroId = (typeof HEROES !== "undefined" && HEROES[heroData.meta.id]) 
      ? heroData.meta.id 
      : heroData.meta.globalIndex;

    if (typeof sfx !== "undefined" && sfx.playTargetFound) sfx.playTargetFound();

    document.body.classList.add("card-active");

    if (hint) hint.classList.add("hidden");
    if (dock) dock.style.display = "flex";
    if (soundBtn) soundBtn.style.display = "inline-flex";

    if (heroData.heroObj) {
      applyHeroTheme(heroData.heroObj);
      showChampionUI();
    } else {
      showChampionUI();
    }

    playTargetVideo(index);
  });

  targetEl.addEventListener("targetLost", () => {
    stopTargetVideo(index);

    if (visibleTargets.size === 0) {
      currentActiveTargetIndex = null;
      currentHeroId = null;
      document.body.classList.remove("card-active");

      // Скрываем нижний интерактивный док кнопок (Биография/Экзамен/Дуэль)
      if (dock) {
        dock.style.display = "none";
        dock.innerHTML = "";
      }
      // Возвращаем прицел сканера
      if (hint) {
        hint.classList.remove("hidden");
      }
    }
  });
});

// ==========================================
// 7. ТЕМЫ И ЗВУК
// ==========================================
function applyHeroTheme(hero) {
  if (!hero) return;
  if (hero.color) document.documentElement.style.setProperty('--accent-color', hero.color);
  if (hero.colorGlow) document.documentElement.style.setProperty('--accent-glow', hero.colorGlow);
  if (soundBtn && hero.color) soundBtn.style.borderColor = hero.color;
}

document.addEventListener("DOMContentLoaded", () => {
  const sBtn = document.getElementById("sound-toggle");
  if (sBtn) {
    sBtn.addEventListener("click", () => {
      const isEnabled = (typeof sfx !== "undefined" && sfx.toggle) ? sfx.toggle() : !isMuted;
      isMuted = !isEnabled;
      
      if (currentActiveTargetIndex !== null) {
        const vid = getVideoElementForTarget(currentActiveTargetIndex);
        if (vid) {
          vid.muted = isMuted;
          vid.volume = 1.0;
        }
      }
      
      sBtn.innerHTML = isEnabled ? "<span>🔊</span> ЗВУК: ВКЛ" : "<span>🔇</span> ЗВУК: ВЫКЛ";
      if (isEnabled && typeof sfx !== "undefined" && sfx.playMove) {
        sfx.playMove();
      }
    });
  }
});

// ==========================================
// 8. МОДАЛЬНЫЕ ОКНА И МЕНЮ
// ==========================================
function openModal(type) {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  if (currentHeroId === null || typeof HEROES === "undefined") return;
  const hero = HEROES[currentHeroId];
  if (!hero) return;

  if (currentActiveTargetIndex !== null) {
    const activeVideo = getVideoElementForTarget(currentActiveTargetIndex);
    if (activeVideo) activeVideo.pause();
  }

  if (navigator.vibrate) navigator.vibrate(35);

  if (type === 'bio') {
    modalContent.innerHTML = `
      <div class="modal-title">${hero.name}</div>
      <div class="modal-subtitle">${hero.title || ''}</div>
      ${hero.quote ? `<div class="modal-quote">${hero.quote}</div>` : ''}
      ${hero.bio ? hero.bio.map(sec => `
        <div class="bio-section-title">${sec.title}</div>
        <div class="bio-paragraph">${sec.text}</div>
      `).join('') : ''}
    `;
  } else if (type === 'test') {
    currentPuzzleIndex = 0;
    testScore = 0;
    renderPuzzleQuestion();
  } else if (type === 'stats') {
    modalContent.innerHTML = `
      <div class="modal-title">Характеристики</div>
      <div class="modal-subtitle">${hero.name}</div>
      ${hero.stats ? hero.stats.map(s => `
        <div class="stat-row">
          <div class="stat-header"><span>${s.name}</span><span>${s.val}%</span></div>
          <div class="stat-track"><div class="stat-fill" style="width: ${s.val}%"></div></div>
        </div>
      `).join('') : ''}
      ${hero.skillName ? `
      <div class="skill-box">
        <div style="font-size: 11px; color: var(--accent-color); font-weight: 700; text-transform: uppercase;">Ключевой навык:</div>
        <div style="font-size: 14px; font-weight: bold; margin-top: 3px;">${hero.skillName}</div>
        <div style="font-size: 12px; color: #aaa; margin-top: 5px; line-height: 1.4;">${hero.skillDesc || ''}</div>
      </div>` : ''}
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

function showChampionUI() {
  if (!dock) return;
  dock.style.display = "flex";
  dock.innerHTML = `
    <button class="dock-btn" onclick="openModal('bio')"><span>Биография</span></button>
    <button class="dock-btn" onclick="openModal('test')"><span>Экзамен</span></button>
    <button class="dock-btn" onclick="if(typeof openAIChatModal==='function')openAIChatModal()" style="border-color: rgba(56, 189, 248, 0.4); box-shadow: 0 0 15px rgba(56, 189, 248, 0.15);">
      <span style="color: #38bdf8;">Диалог</span>
    </button>
    <button class="dock-btn" onclick="NetDuel.openLobby()" style="border-color: rgba(226, 184, 104, 0.4); box-shadow: 0 0 15px rgba(226, 184, 104, 0.15);">
      <span style="color: var(--accent-gold);">Дуэль</span>
    </button>
  `;
}

function stopAllTargetVideosImmediate() {
  ALL_TARGET_INDICES.forEach(index => {
    const vid = getVideoElementForTarget(index);
    const targetEl = document.getElementById(`target-${index}`);
    if (vid) {
      vid.pause();
      vid.muted = true;
      vid.currentTime = 0;
      if (vid._checkReadyInterval) {
        clearInterval(vid._checkReadyInterval);
        vid._checkReadyInterval = null;
      }
    }
    if (targetEl) {
      const aVideo = targetEl.querySelector('a-video');
      if (aVideo) {
        aVideo.setAttribute('scale', '0 0 0');
        aVideo.setAttribute('material', 'transparent: true; opacity: 0;');
      }
    }
  });
}

function closeModal() {
  if (typeof sfx !== "undefined" && sfx.playMove) sfx.playMove();
  modal.classList.remove("active");

  if (currentActiveTargetIndex !== null && visibleTargets.has(currentActiveTargetIndex)) {
    const activeVideo = getVideoElementForTarget(currentActiveTargetIndex);
    if (activeVideo) activeVideo.play().catch(() => {});
  } else {
    stopAllTargetVideosImmediate();
  }
}

// ==========================================
// 9. ВИКТОРИНЫ И ТЕСТЫ
// ==========================================
function renderPuzzleQuestion() {
  const hero = HEROES[currentHeroId];
  if (!hero || !hero.puzzles || !hero.puzzles.length) return;
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
    <div class="difficulty-badge">${p.difficulty || 'Тактика'}</div>
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
    fb.innerHTML = `<b>ВЕРНО!</b> ${opt.comment || ''}`;
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    if (navigator.vibrate) navigator.vibrate(180);
    fb.style.background = "rgba(231, 76, 60, 0.2)";
    fb.style.color = "#e74c3c";
    fb.style.border = "1px solid #e74c3c";
    fb.innerHTML = `<b>НЕВЕРНО.</b> ${opt.comment || ''}`;
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
      evaluation = `<b>Абсолютный триумф!</b><br>${hero.name} признал ваше мастерство и добавлен в Паспорт!`;
    } else {
      evaluation = `<b>Экзамен успешно сдан!</b><br>Отличная тактика. ${hero.name} открыт в вашей Коллекции!`;
    }
  } else {
    if (typeof sfx !== "undefined" && sfx.playWrong) sfx.playWrong();
    evaluation = `❌ <b>Экзамен не сдан.</b><br>Для зачета нужно набрать минимум <b>${passThreshold} из ${hero.puzzles.length}</b>.<br>Изучите биографию и попробуйте снова!`;
  }

  const resultColor = isPassed ? "var(--accent-color, #2ecc71)" : "#ff4d6d";

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
        Изучить биографию ${hero.name.split(' ')[0]}
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
      ${isPassed ? 'Пройти еще раз' : 'Попробовать снова'}
    </button>
  `;
}