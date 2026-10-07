    // ================= ЛОГИКА ДУЭЛИ (HOTSEAT) =================
let duelState = {
  active: false,
  p1Hero: null,
  p2Hero: null,
  p1Hp: 100,
  p2Hp: 100,
  roundIndex: 0,
  roundLocked: false,
  deck: []
};

function startHotseatDuel() {
  if (currentHeroId === null) return;

  const activeVideo = document.getElementById(`vid-${currentHeroId}`);
  if (activeVideo) activeVideo.pause();

  const p1 = HEROES[currentHeroId];
  const otherIds = Object.keys(HEROES).map(Number).filter(id => id !== currentHeroId);
  const p2Id = otherIds[Math.floor(Math.random() * otherIds.length)];
  const p2 = HEROES[p2Id];

  duelState.p1Hero = p1;
  duelState.p2Hero = p2;
  duelState.p1Hp = 100;
  duelState.p2Hp = 100;
  duelState.roundIndex = 0;
  duelState.roundLocked = false;

  fillDuelDeck();

  document.getElementById("p1-name").innerText = p1.name;
  document.getElementById("p1-name").style.color = p1.color;
  document.getElementById("p1-hp-bar").style.background = p1.color;

  document.getElementById("p2-name").innerText = p2.name;
  document.getElementById("p2-name").style.color = p2.color;
  document.getElementById("p2-hp-bar").style.background = p2.color;

  document.getElementById("hs-gameover").classList.remove("active");
  document.getElementById("hotseat-arena").classList.add("active");

  updateHpBars();
  loadNextDuelRound();
}

function fillDuelDeck() {
  duelState.deck = [
    ...duelState.p1Hero.puzzles,
    ...duelState.p2Hero.puzzles
  ].sort(() => Math.random() - 0.5);
}

function updateHpBars() {
  document.getElementById("p1-hp-num").innerText = `${duelState.p1Hp}%`;
  document.getElementById("p1-hp-bar").style.width = `${duelState.p1Hp}%`;
  document.getElementById("p2-hp-num").innerText = `${duelState.p2Hp}%`;
  document.getElementById("p2-hp-bar").style.width = `${duelState.p2Hp}%`;
}

function loadNextDuelRound() {
  if (duelState.p1Hp <= 0 || duelState.p2Hp <= 0) {
    endDuel();
    return;
  }

  duelState.roundLocked = false;
  duelState.roundIndex++;

  if (duelState.deck.length === 0) {
    fillDuelDeck();
  }
  const q = duelState.deck.pop();
  duelState.currentQuestion = q;

  document.getElementById("hs-round-info").innerText = `РАУНД ${duelState.roundIndex}`;

  const hasImage = !!q.image;

  ['p1', 'p2'].forEach(player => {
    const imgEl = document.getElementById(`${player}-board-img`);
    const promptEl = document.getElementById(`${player}-prompt`);
    const optContainer = document.getElementById(`${player}-options`);

    if (hasImage) {
      imgEl.src = q.image;
      imgEl.style.display = "block";
      promptEl.innerText = "🎯 НАЙДИТЕ ЛУЧШИЙ ХОД:";
      promptEl.style.color = "var(--accent-color)";
    } else {
      imgEl.style.display = "none";
      promptEl.innerText = q.desc;
      promptEl.style.color = "#eee";
    }

    optContainer.innerHTML = q.options.map((opt, i) => `
      <button class="hs-opt-btn" onclick="handleDuelTap('${player}', ${i})">
        ${opt.text}
      </button>
    `).join('');
  });
}

function handleDuelTap(player, optIndex) {
  if (duelState.roundLocked) return;
  duelState.roundLocked = true;

  const q = duelState.currentQuestion;
  const isCorrect = q.options[optIndex].correct;

  if (navigator.vibrate) navigator.vibrate(isCorrect ? 70 : 180);

  if (player === 'p1') {
    if (isCorrect) {
      sfx.playCorrect();
      duelState.p2Hp = Math.max(0, duelState.p2Hp - 25);
      flashPrompt('p1', '⚡ ТОЧНЫЙ ХОД! (-25%)', '#2ecc71');
      flashPrompt('p2', '💥 ПРОПУЩЕН УДАР! (-25%)', '#e74c3c');
    } else {
      sfx.playWrong();
      duelState.p1Hp = Math.max(0, duelState.p1Hp - 15);
      flashPrompt('p1', '❌ ЗЕВОК! ОШИБКА (-15%)', '#e74c3c');
      flashPrompt('p2', '🛡️ СОПЕРНИК ОШИБСЯ!', '#2ecc71');
    }
  } else {
    if (isCorrect) {
      duelState.p1Hp = Math.max(0, duelState.p1Hp - 25);
      flashPrompt('p2', '⚡ ТОЧНЫЙ ХОД! (-25%)', '#2ecc71');
      flashPrompt('p1', '💥 ПРОПУЩЕН УДАР! (-25%)', '#e74c3c');
    } else {
      duelState.p2Hp = Math.max(0, duelState.p2Hp - 15);
      flashPrompt('p2', '❌ ЗЕВОК! ОШИБКА (-15%)', '#e74c3c');
      flashPrompt('p1', '🛡️ СОПЕРНИК ОШИБСЯ!', '#2ecc71');
    }
  }

  updateHpBars();

  setTimeout(() => {
    loadNextDuelRound();
  }, 1200);
}

function flashPrompt(player, text, color) {
  const promptEl = document.getElementById(`${player}-prompt`);
  promptEl.innerHTML = `<span style="color: ${color}; font-size: 11px; font-weight: 900;">${text}</span>`;
}

function endDuel() {
  const goModal = document.getElementById("hs-gameover");
  const title = document.getElementById("hs-winner-title");
  const desc = document.getElementById("hs-winner-desc");
  let winner = null;

   sfx.playCheckmate();
  
  if (duelState.p1Hp <= 0 && duelState.p2Hp > 0) winner = duelState.p2Hero;
  else if (duelState.p2Hp <= 0 && duelState.p1Hp > 0) winner = duelState.p1Hero;

  if (winner) {
    title.innerText = "ШАХ И МАТ!";
    title.style.color = winner.color;
    desc.innerHTML = `Победу одержал <b>${winner.name}</b>!<br>Король соперника повержен на ${duelState.roundIndex} раунде.`;
  }

  goModal.classList.add("active");
}

function exitDuel() {
  document.getElementById("hotseat-arena").classList.remove("active");
  if (currentHeroId !== null) {
    const vid = document.getElementById(`vid-${currentHeroId}`);
    if (vid) vid.play().catch(() => {});
  }
}
