// ================= ДИАЛОГ С ЛЕГЕНДОЙ ЧЕРЕЗ AMVERA (DEEPSEEK) =================

const AMVERA_API_URL = "https://chesslegendsai-tacticusfinch.mia0.amvera.tech/api/ask";

function openAIChatModal() {
  sfx.playMove();
  if (currentHeroId === null) return;
  const hero = HEROES[currentHeroId];

  // Приостанавливаем видео на время диалога
  const activeVideo = document.getElementById(`vid-${currentHeroId}`);
  if (activeVideo) activeVideo.pause();

  modalContent.innerHTML = `
  <div class="modal-title" style="color: ${hero.color};">Беседа с мастером</div>
  <div class="modal-subtitle">${hero.name}</div>

  <!-- Область диалога -->
  <div id="ai-chat-box" style="height: 220px; overflow-y: auto; background: rgba(0,0,0,0.4); border-radius: 14px; padding: 14px; margin: 12px 0; border: 1px solid rgba(255,255,255,0.08); font-size: 13px; line-height: 1.55;">
    <div style="color: ${hero.color}; margin-bottom: 8px;">
      <b>${hero.name}:</b> Приветствую. Сформулируйте ваш вопрос о позиции, стратегии или моем турнирном пути.
    </div>
  </div>

  <!-- Поле ввода, кнопка отправки и голосовой ввод -->
  <div style="display: flex; gap: 8px; align-items: center;">
    <input id="ai-chat-input" type="text" placeholder="Задайте вопрос гроссмейстеру..." 
      style="flex: 1; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); color: #fff; font-size: 13px; outline: none;"
      onkeydown="if(event.key==='Enter') sendChatMessage()">
    <button class="action-link-btn" style="width: auto; padding: 12px 18px; margin: 0; background: var(--accent-gold); color: #000; font-weight: 700;" onclick="sendChatMessage()">
      Отправить
    </button>
    <button id="ai-mic-btn" class="action-link-btn secondary" style="width: auto; padding: 12px 14px; margin: 0; font-size: 11px; text-transform: uppercase;" onclick="toggleSpeechRecognition()">
      Голос
    </button>
  </div>
`;

  modal.classList.add("active");
}

async function sendChatMessage() {
  const input = document.getElementById("ai-chat-input");
  const chatBox = document.getElementById("ai-chat-box");
  const text = input.value.trim();
  if (!text) return;

  const hero = HEROES[currentHeroId];
  input.value = "";
  sfx.playMove();

  // Хак для Safari/iOS: создаем инстанс плеера в момент пользовательского клика
  const heroAudio = new Audio();

  // Добавляем реплику пользователя и индикатор ожидания
  chatBox.innerHTML += `
    <div style="color: #fff; margin-top: 8px; text-align: right;">
      <span style="background: rgba(255, 255, 255, 0.1); padding: 5px 10px; border-radius: 8px; display: inline-block;">
        <b>Вы:</b> ${text}
      </span>
    </div>
    <div id="ai-thinking-indicator" style="color: #aaa; font-style: italic; margin-top: 8px;">
      ${hero.name} обдумывает ответ...
    </div>
  `;
  chatBox.scrollTop = chatBox.scrollHeight;

  try {
    const systemPrompt = HERO_AI_PROMPTS[currentHeroId] || 
      `Ты — ${hero.name}. Ответь кратко, емко и в своем стиле шахматиста.`;

    const response = await fetch(AMVERA_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_prompt: systemPrompt,
        user_message: text,
        hero_id: currentHeroId !== null ? currentHeroId : 0
      })
    });

    if (!response.ok) throw new Error("Ошибка связи с сервером");

    const data = await response.json();
    const reply = data.reply;

    // Убираем индикатор ожидания
    const loader = document.getElementById("ai-thinking-indicator");
    if (loader) loader.remove();

    // Плашка времени (если сервер прислал benchmark)
    const timeBadge = data.benchmark?.total_sec 
      ? `<div style="font-size: 9px; color: #7a8b9e; margin-top: 2px;">⚡ Ответ готов за ${data.benchmark.total_sec} сек.</div>`
      : '';

    // Выводим ответ чемпиона
    chatBox.innerHTML += `
      <div style="color: ${hero.color}; margin-top: 10px;">
        <b>${hero.name}:</b> ${reply}
        ${timeBadge}
      </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;

    // Воспроизведение звука: если пришел студийный Дмитрий — играем его, иначе браузерный синтезатор
    if (data.audio) {
      heroAudio.src = data.audio;
      heroAudio.play().catch(err => {
        console.warn("Автовоспроизведение MP3 не удалось, включаем синтезатор:", err);
        speakHeroVoice(reply);
      });
    } else {
      speakHeroVoice(reply);
    }

  } catch (err) {
    const loader = document.getElementById("ai-thinking-indicator");
    if (loader) loader.remove();

    chatBox.innerHTML += `
      <div style="color: #ff4d6d; margin-top: 8px; font-size: 11px;">
        ⚠️ Не удалось связаться с сервером Amvera. Проверьте статус приложения в панели.
      </div>
    `;
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

// Голосовой ввод через Web Speech API
let recognition = null;
function toggleSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Голосовой ввод не поддерживается вашим браузером. Пожалуйста, используйте текстовое поле.");
    return;
  }

  const micBtn = document.getElementById("ai-mic-btn");

  if (!recognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.interimResults = false;

    recognition.onstart = () => {
      micBtn.style.background = "#ff0055";
      micBtn.innerText = "🛑";
    };

    recognition.onresult = (e) => {
      const speechResult = e.results[0][0].transcript;
      document.getElementById("ai-chat-input").value = speechResult;
      sendChatMessage();
    };

    recognition.onend = () => {
      micBtn.style.background = "";
      micBtn.innerText = "🎙️";
      recognition = null;
    };

    recognition.onerror = () => {
      micBtn.style.background = "";
      micBtn.innerText = "🎙️";
      recognition = null;
    };

    recognition.start();
  } else {
    recognition.stop();
  }
}

// Озвучка ответа персонажа
function speakHeroVoice(text) {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // сбрасываем прошлую речь
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "ru-RU";
  utter.rate = 1.0;

  // Получаем список доступных голосов в системе
  const voices = window.speechSynthesis.getVoices();
  
  // Ищем русскоязычные голоса
  const ruVoices = voices.filter(v => v.lang.includes("ru") || v.lang.includes("RU"));

  // Пытаемся найти мужской голос (популярные имена в Windows/Google/Apple)
  const maleVoice = ruVoices.find(v => 
    v.name.toLowerCase().includes("dmitry") || 
    v.name.toLowerCase().includes("pavel") || 
    v.name.toLowerCase().includes("yuri") || 
    v.name.toLowerCase().includes("male") ||
    v.name.toLowerCase().includes("man")
  );

  if (maleVoice) {
    utter.voice = maleVoice;
  } else if (ruVoices.length > 0) {
    // Если мужской не найден по имени, берем первый доступный русский
    utter.voice = ruVoices[0];
  }

  // Настройки тембра (Pitch) под характер
  if (currentHeroId === 6) {
    // Stockfish (низкий робо-бас)
    utter.pitch = 0.2;
    utter.rate = 1.1;
  } else if (currentHeroId === 10 || currentHeroId === 11) {
    // Молодые гроссмейстеры (Накамура, Гукеш)
    utter.pitch = 0.95;
    utter.rate = 1.1;
  } else {
    // Взрослые чемпионы (Таль, Ботвинник, Стейниц) — занижаем тон для солидности
    utter.pitch = 0.75; 
  }

  window.speechSynthesis.speak(utter);
}

// Браузеры загружают голоса асинхронно, поэтому нужно пнуть их инициализацию при старте:
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}
