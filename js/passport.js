// ================= ЛОГИКА ПАСПОРТА ГРОССМЕЙСТЕРА =================

// Структура хранилища: { unlocked: [0, 1, ...], testsPassed: [0, ...] }
const PASSPORT_KEY = "tacticus_chess_passport_v1";

function getPassportData() {
  try {
    const data = localStorage.getItem(PASSPORT_KEY);
    return data ? JSON.parse(data) : { unlocked: [], testsPassed: [] };
  } catch(e) {
    return { unlocked: [], testsPassed: [] };
  }
}

function savePassportData(data) {
  try {
    localStorage.setItem(PASSPORT_KEY, JSON.stringify(data));
    updatePassportCounter();
  } catch(e) {}
}

// Обновление счетчика на кнопке в HUD
function updatePassportCounter() {
  const data = getPassportData();
  const counterEl = document.getElementById("passport-counter");
  if (counterEl) {
    const totalHeroes = Object.keys(HEROES).length;
    counterEl.innerText = `(${data.unlocked.length}/${totalHeroes})`;
    if (data.unlocked.length === totalHeroes) {
      counterEl.style.color = "#f1c40f";
    }
  }
}

// Регистрация нахождения новой карты при наведении камеры
function registerCardDiscovery(heroId) {
  if (heroId === null || heroId === undefined) return;
  const data = getPassportData();
  if (!data.unlocked.includes(heroId)) {
    data.unlocked.push(heroId);
    savePassportData(data);
    showUnlockToast(HEROES[heroId].name);
  }
}

// Регистрация успешной сдачи теста
function registerTestPassed(heroId) {
  if (heroId === null || heroId === undefined) return;
  const data = getPassportData();
  if (!data.testsPassed.includes(heroId)) {
    data.testsPassed.push(heroId);
    savePassportData(data);
  }
}

// Анимация всплывающего бейджа
function showUnlockToast(heroName) {
  const toast = document.getElementById("unlock-toast");
  const text = document.getElementById("unlock-toast-text");
  if (!toast || !text) return;

  text.innerText = `ОТКРЫТ: ${heroName.toUpperCase()}`;
  toast.classList.add("show");
  if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

// Иконки шахматных фигур для слотов
const HERO_ICONS = ["♚", "♛", "♜", "♝", "♞", "♟", "🤖", "♚", "♛", "♝", "♞", "♟", "♜", "♚", "♛"];

// Открытие модального окна Паспорта
function openPassportModal() {
  sfx.playMove();
  const data = getPassportData();
  const total = Object.keys(HEROES).length;
  const progressPercent = Math.round((data.unlocked.length / total) * 100);
  const isComplete = data.unlocked.length === total;

  let gridHtml = '';
  for (let i = 0; i < total; i++) {
    const hero = HEROES[i];
    const isUnlocked = data.unlocked.includes(i);
    const testDone = data.testsPassed.includes(i);
    
    // Инициалы для запасного варианта (например, "В.С." или "М.Т.")
    const initials = hero.name.split(' ').map(n => n[0]).join('');

if (isUnlocked) {
      gridHtml += `
        <div class="passport-slot unlocked">
          ${testDone ? '<span class="passport-badge-test" title="Экзамен сдан">✓</span>' : ''}
          <div class="passport-avatar-wrap">
            ${hero.avatar ? `
              <img class="passport-avatar-img" src="${hero.avatar}" alt="${hero.name}" 
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div class="passport-monogram" style="display:none;">${initials}</div>
            ` : `
              <div class="passport-monogram">${initials}</div>
            `}
          </div>
          <div class="passport-hero-name">${hero.name.split(' ').pop()}</div>
        </div>
      `;
    } else {
      // Закрытый слот
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
    <div class="modal-title" style="color: #f1c40f;">Моя коллекция</div>
    <div class="modal-subtitle">Коллекция легенд шахматной школы</div>

    <!-- Прогресс сбора -->
    <div style="margin: 10px 0;">
      <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px; font-weight:700;">
        <span>Собрано легенд: ${data.unlocked.length} из ${total}</span>
        <span style="color:#f1c40f;">${progressPercent}%</span>
      </div>
      <div style="height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
        <div style="height:100%; width:${progressPercent}%; background:linear-gradient(90deg, #f1c40f, #00ffcc); transition: width 0.4s ease;"></div>
      </div>
    </div>

    <!-- Сетка карточек -->
    <div class="passport-grid">
      ${gridHtml}
    </div>

    ${isComplete ? `
      <!-- Блок триумфа и генерации диплома -->
      <div style="margin-top: 14px; padding: 14px; background: rgba(241, 196, 15, 0.1); border: 1.5px solid #f1c40f; border-radius: 12px; text-align: center;">
        <div style="font-size: 13px; font-weight: 800; color: #f1c40f;">ВСЯ КОЛЛЕКЦИЯ СОБРАНА!</div>
        <div style="font-size: 11px; color: #ccc; margin: 4px 0 10px 0;">Вы разблокировали почетный диплом школы «Тактикус Финч»</div>
        
        <input id="diploma-name-input" type="text" placeholder="Введите ваше имя и фамилию" 
          style="width: 100%; box-sizing: border-box; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.5); color: #fff; font-size: 12px; text-align: center; margin-bottom: 8px;">

        <button class="action-link-btn" onclick="generateDiplomaCanvas()" style="background: #f1c40f; color: #000;">
          🎓 Скачать именной диплом
        </button>
      </div>
    ` : `
      <div style="font-size: 11px; color: #8a99ad; text-align: center; margin-top: 10px; line-height: 1.4;">
        Наводите камеру на физические карточки, чтобы открыть все 15 легенд и получить диплом гроссмейстера!
      </div>
    `}
  `;

  modal.classList.add("active");
}

// Генерация красивого диплома прямо в браузере через Canvas
function generateDiplomaCanvas() {
  sfx.playCorrect();
  const nameInput = document.getElementById("diploma-name-input");
  const userName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : "Юный Гроссмейстер";

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  // Фон - глубокий темный космос с градиентом
  const bgGrad = ctx.createLinearGradient(0, 0, 1200, 800);
  bgGrad.addColorStop(0, "#0a0f1d");
  bgGrad.addColorStop(1, "#03060b");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1200, 800);

  // Золотая рамка
  ctx.strokeStyle = "#f1c40f";
  ctx.lineWidth = 8;
  ctx.strokeRect(30, 30, 1140, 740);

  ctx.strokeStyle = "rgba(0, 255, 204, 0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, 1110, 710);

  // Заголовок
  ctx.textAlign = "center";
  ctx.fillStyle = "#f1c40f";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("ШАХМАТНАЯ ШКОЛА «ТАКТИКУС ФИНЧ»", 600, 120);

  // Титул диплома
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 58px sans-serif";
  ctx.fillText("ДИПЛОМ МАГИСТРА", 600, 210);

  // Подзаголовок
  ctx.fillStyle = "#00ffcc";
  ctx.font = "20px sans-serif";
  ctx.fillText("НАСТОЯЩИЙ СЕРТИФИКАТ ПОДТВЕРЖДАЕТ, ЧТО", 600, 280);

  // Имя ученика
  ctx.fillStyle = "#f1c40f";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(userName.toUpperCase(), 600, 370);

  // Линия под именем
  ctx.strokeStyle = "#f1c40f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 395);
  ctx.lineTo(850, 395);
  ctx.stroke();

  // Описание подвига
  ctx.fillStyle = "#dddddd";
  ctx.font = "22px sans-serif";
  ctx.fillText("успешно исследовал наследие всех 15 Чемпионов и Легенд мира по шахматам,", 600, 460);
  ctx.fillText("овладел тактическим видением и завершил интерактивный курс проекта.", 600, 500);

  // Печать и значки
  ctx.font = "60px sans-serif";
  ctx.fillText("♚ ♛ ♞", 600, 600);

  // Дата и подпись
  const today = new Date().toLocaleDateString('ru-RU');
  ctx.fillStyle = "#8a99ad";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Дата выдачи: ${today}`, 250, 690);
  ctx.fillText("Основатель: Тактикус Финч", 950, 690);

  // Скачивание файла
  const link = document.createElement("a");
  link.download = `Диплом_Тактикус_Финч_${userName.replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}