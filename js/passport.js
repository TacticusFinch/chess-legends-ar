// ================= ЛОГИКА ПАСПОРТА ГРОССМЕЙСТЕРА =================
// Хранилище: { unlocked: [индексы], testsPassed: [индексы] }
// ВАЖНО: индексы — числовые ключи HERO_STATS_DATA (0..18),
// потому что в конце heroes-data.js герои дублируются по строковым id,
// и Object.keys(HEROES).length даёт 38 вместо 19.

const PASSPORT_KEY = "tacticus_chess_passport_v1";

/* ---------- служебное ---------- */

// Реальное количество героев: 19 числовых карточек
function getHeroesTotal() {
  if (typeof HERO_STATS_DATA !== "undefined") {
    return Object.keys(HERO_STATS_DATA).filter(k => !isNaN(Number(k))).length;
  }
  if (typeof HEROES === "undefined") return 0;
  return Object.keys(HEROES).filter(k => !isNaN(Number(k))).length;
}

// Приводим любой id (число, "7", "tal") к числовому индексу карточки
function getHeroIndex(heroId) {
  if (heroId === null || heroId === undefined) return null;
  if (typeof HEROES === "undefined") return null;

  const numeric = Number(heroId);
  if (!isNaN(numeric) && HEROES[numeric]) return numeric;

  const key = String(heroId);
  if (HEROES[key] && HEROES[key].id !== undefined) {
    const found = Object.keys(HEROES).find(k => !isNaN(Number(k)) && HEROES[k] && HEROES[k].id === HEROES[key].id);
    return found !== undefined ? Number(found) : null;
  }

  const foundDirect = Object.keys(HEROES).find(k => !isNaN(Number(k)) && HEROES[k] && HEROES[k].id === key);
  return foundDirect !== undefined ? Number(foundDirect) : null;
}

function safeSfx(method) {
  if (typeof sfx !== "undefined" && sfx && typeof sfx[method] === "function") {
    try { sfx[method](); } catch (e) {}
  }
}

/* ---------- данные ---------- */

function getPassportData() {
  try {
    const data = localStorage.getItem(PASSPORT_KEY);
    const parsed = data ? JSON.parse(data) : null;
    if (!parsed || typeof parsed !== "object") return { unlocked: [], testsPassed: [] };
    return {
      unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      testsPassed: Array.isArray(parsed.testsPassed) ? parsed.testsPassed : []
    };
  } catch (e) {
    return { unlocked: [], testsPassed: [] };
  }
}

function savePassportData(data) {
  try {
    localStorage.setItem(PASSPORT_KEY, JSON.stringify(data));
    updatePassportCounter();
  } catch (e) {}
}

// Обновление счетчика на кнопке в HUD
function updatePassportCounter() {
  const data = getPassportData();
  const counterEl = document.getElementById("passport-counter");
  if (!counterEl) return;

  const total = getHeroesTotal();
  counterEl.innerText = `(${data.unlocked.length}/${total})`;
  counterEl.style.color = data.unlocked.length === total && total > 0 ? "#d4b475" : "";
}

// Регистрация нахождения новой карты при наведении камеры
function registerCardDiscovery(heroId) {
  const index = getHeroIndex(heroId);
  if (index === null) return;

  const data = getPassportData();
  if (data.unlocked.includes(index)) return;

  data.unlocked.push(index);
  savePassportData(data);

  safeSfx("playCardUnlock");

  const hero = HEROES[index];
  if (hero) showUnlockToast(hero.name);
}

// Регистрация успешной сдачи теста или финала квеста
function registerTestPassed(heroId) {
  const index = getHeroIndex(heroId);
  if (index === null) return;

  const data = getPassportData();
  if (data.testsPassed.includes(index)) return;

  data.testsPassed.push(index);
  savePassportData(data);
}

// Анимация всплывающего бейджа
function showUnlockToast(heroName) {
  const toast = document.getElementById("unlock-toast");
  const text = document.getElementById("unlock-toast-text");
  if (!toast || !text) return;

  text.innerText = `ОТКРЫТ: ${String(heroName).toUpperCase()}`;
  toast.classList.add("show");
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Открытие модального окна Паспорта
function openPassportModal() {
  safeSfx("playMove");

  if (typeof modal === "undefined" || !modal || typeof modalContent === "undefined" || !modalContent) {
    console.warn("[passport] модальное окно не найдено");
    return;
  }

  const data = getPassportData();
  const total = getHeroesTotal();
  const progressPercent = total > 0 ? Math.round((data.unlocked.length / total) * 100) : 0;
  const isComplete = total > 0 && data.unlocked.length >= total;

  let gridHtml = "";

  for (let i = 0; i < total; i++) {
    const hero = HEROES[i];

    // Защита от дыр в нумерации: раньше здесь падало на hero.name
    if (!hero) {
      gridHtml += `
        <div class="passport-slot locked">
          <div class="passport-avatar-wrap"><span class="passport-lock-icon">🔒</span></div>
          <div class="passport-hero-name">№ ${i + 1}</div>
        </div>
      `;
      continue;
    }

    const isUnlocked = data.unlocked.includes(i);
    const testDone = data.testsPassed.includes(i);
    const initials = String(hero.name || "?").split(" ").map(n => n[0]).join("");

    if (isUnlocked) {
      gridHtml += `
        <div class="passport-slot unlocked">
          ${testDone ? '<span class="passport-badge-test" title="Экзамен и квест пройдены">✓</span>' : ''}
          <div class="passport-avatar-wrap">
            ${hero.avatar ? `
              <img class="passport-avatar-img" src="${hero.avatar}" alt="${hero.name}"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="passport-monogram" style="display:none;">${initials}</div>
            ` : `
              <div class="passport-monogram">${initials}</div>
            `}
          </div>
          <div class="passport-hero-name">${String(hero.name).split(" ").pop()}</div>
        </div>
      `;
    } else {
      gridHtml += `
        <div class="passport-slot locked">
          <div class="passport-avatar-wrap">
            <span class="passport-lock-icon">🔒</span>
          </div>
          <div class="passport-hero-name">№ ${i + 1}</div>
        </div>
      `;
    }
  }

  modalContent.innerHTML = `
    <div class="modal-title" style="color: #d4b475;">Моя коллекция</div>
    <div class="modal-subtitle">Коллекция легенд шахматной школы</div>

    <div style="margin: 10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; font-weight:700;">
        <span>Собрано легенд: ${data.unlocked.length} из ${total}</span>
        <span style="color:#d4b475;">${progressPercent}%</span>
      </div>
      <div style="height:6px; background:rgba(242,239,233,0.08); border-radius:3px; overflow:hidden;">
        <div style="height:100%; width:${progressPercent}%; background:linear-gradient(90deg, #d4b475, #8fb8a8); transition: width 0.4s ease;"></div>
      </div>
    </div>

    <div class="passport-grid">
      ${gridHtml}
    </div>

    ${isComplete ? `
      <div style="margin-top: 14px; padding: 14px; background: rgba(212,180,117,0.08); border: 1px solid rgba(212,180,117,0.4); border-radius: 12px; text-align: center;">
        <div style="font-size: 13px; font-weight: 800; color: #d4b475;">ВСЯ КОЛЛЕКЦИЯ СОБРАНА!</div>
        <div style="font-size: 11px; color: #9e9b93; margin: 4px 0 10px 0;">Вы разблокировали почетный диплом школы «Тактикус Финч»</div>

        <input id="diploma-name-input" type="text" placeholder="Введите ваше имя и фамилию"
          style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px; border: 1px solid rgba(242,239,233,0.15); background: rgba(0,0,0,0.5); color: #f2efe9; font-size: 12px; text-align: center; margin-bottom: 8px;">

        <button class="action-link-btn" onclick="generateDiplomaCanvas()" style="background: #d4b475; color: #000;">
          🎓 Скачать именной диплом
        </button>
      </div>
    ` : `
      <div style="font-size: 11px; color: #68655e; text-align: center; margin-top: 10px; line-height: 1.4;">
        Наведите камеру на физические карточки и пройдите испытания, чтобы открыть всех героев и получить секретный приз!
      </div>
    `}
  `;

  modal.classList.add("active");
}

// Генерация диплома прямо в браузере через Canvas
function generateDiplomaCanvas() {
  safeSfx("playCorrect");

  const nameInput = document.getElementById("diploma-name-input");
  const userName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "Юный Гроссмейстер";
  const total = getHeroesTotal();

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 800);
  bgGrad.addColorStop(0, "#0c0d10");
  bgGrad.addColorStop(1, "#030406");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 800);

  ctx.strokeStyle = "#d4b475";
  ctx.lineWidth = 6;
  ctx.strokeRect(30, 30, 1140, 740);

  ctx.strokeStyle = "rgba(143, 184, 168, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(45, 45, 1110, 710);

  ctx.textAlign = "center";

  ctx.fillStyle = "#d4b475";
  ctx.font = "600 26px sans-serif";
  ctx.fillText("ШАХМАТНАЯ ШКОЛА «ТАКТИКУС ФИНЧ»", 600, 120);

  ctx.fillStyle = "#f2efe9";
  ctx.font = "700 56px sans-serif";
  ctx.fillText("ДИПЛОМ МАГИСТРА", 600, 210);

  ctx.fillStyle = "#8fb8a8";
  ctx.font = "16px sans-serif";
  ctx.fillText("НАСТОЯЩИЙ СЕРТИФИКАТ ПОДТВЕРЖДАЕТ, ЧТО", 600, 280);

  ctx.fillStyle = "#d4b475";
  ctx.font = "700 48px sans-serif";
  ctx.fillText(userName.toUpperCase(), 600, 370);

  ctx.strokeStyle = "#d4b475";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(350, 395);
  ctx.lineTo(850, 395);
  ctx.stroke();

  ctx.fillStyle = "#c9c6bf";
  ctx.font = "20px sans-serif";
  ctx.fillText(`успешно исследовал наследие ${total} чемпионов и легенд мира по шахматам,`, 600, 460);
  ctx.fillText("овладел тактическим видением и завершил интерактивный курс проекта.", 600, 498);

  ctx.font = "54px sans-serif";
  ctx.fillText("♚ ♛ ♞", 600, 600);

  const today = new Date().toLocaleDateString("ru-RU");
  ctx.fillStyle = "#68655e";
  ctx.font = "16px sans-serif";
  ctx.fillText(`Дата выдачи: ${today}`, 250, 690);
  ctx.fillText("Основатель: Тактикус Финч", 950, 690);

  const link = document.createElement("a");
  link.download = `Диплом_Тактикус_Финч_${userName.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}