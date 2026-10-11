// ================= ЗВУКОВОЙ ДВИЖОК WEB AUDIO API =================
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = false;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = true;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && (!this.ctx || this.ctx.state === 'suspended')) {
      this.init();
    }
    return this.enabled;
  }

  // 1. Стук деревянной шахматной фигуры
  playMove() {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  // 2. Триумфальные фанфары
  playFanfare() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [
      { freq: 261.63, time: 0.00, dur: 0.15 },
      { freq: 329.63, time: 0.12, dur: 0.15 },
      { freq: 392.00, time: 0.24, dur: 0.18 },
      { freq: 523.25, time: 0.38, dur: 0.40 },
      { freq: 659.25, time: 0.50, dur: 0.90 }
    ];

    notes.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.time);

      gain.gain.setValueAtTime(0.3, now + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);

      const chime = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(n.freq * 2, now + n.time);

      chimeGain.gain.setValueAtTime(0.12, now + n.time);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      chime.connect(chimeGain);
      chimeGain.connect(this.ctx.destination);
      chime.start(now + n.time);
      chime.stop(now + n.time + n.dur);
    });
  }

  // 3. Захват карточки камерой (AR Lock-on)
  playTargetFound() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const createShutterNoise = (startTime, duration, gainVal, cutoffFreq) => {
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(cutoffFreq, startTime);
      filter.Q.setValueAtTime(1.8, startTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(startTime);
      noise.stop(startTime + duration);
    };

    const click1 = this.ctx.createOscillator();
    const click1Gain = this.ctx.createGain();
    click1.type = 'triangle';
    click1.frequency.setValueAtTime(2400, now);
    click1.frequency.exponentialRampToValueAtTime(120, now + 0.025);

    click1Gain.gain.setValueAtTime(0.45, now);
    click1Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    click1.connect(click1Gain);
    click1Gain.connect(this.ctx.destination);
    click1.start(now);
    click1.stop(now + 0.025);

    createShutterNoise(now + 0.005, 0.04, 0.28, 4200);

    const t2 = now + 0.045;

    const click2 = this.ctx.createOscillator();
    const click2Gain = this.ctx.createGain();
    click2.type = 'triangle';
    click2.frequency.setValueAtTime(1800, t2);
    click2.frequency.exponentialRampToValueAtTime(90, t2 + 0.035);

    click2Gain.gain.setValueAtTime(0.5, t2);
    click2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.035);

    click2.connect(click2Gain);
    click2Gain.connect(this.ctx.destination);
    click2.start(t2);
    click2.stop(t2 + 0.035);

    const bodyThump = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyThump.type = 'sine';
    bodyThump.frequency.setValueAtTime(160, t2);
    bodyThump.frequency.exponentialRampToValueAtTime(45, t2 + 0.07);

    bodyGain.gain.setValueAtTime(0.4, t2);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.07);

    bodyThump.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);
    bodyThump.start(t2);
    bodyThump.stop(t2 + 0.07);

    createShutterNoise(t2 + 0.01, 0.05, 0.22, 2800);
  }

  // 4. Правильный ход
  playCorrect() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.12, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.3);
    });
  }

  // 5. Зевок / Ошибка
  playWrong() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.25);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // 6. Шах и мат
  playCheckmate() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [220, 277.18, 329.63, 440];
    freqs.forEach(f => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    });
  }

  // 7. Мелодичный шахматный гонг/колокол при старте дуэли
  playBattleStart() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Благородный мажорный перезвон: F4 -> A4 -> C5 -> E5
    const chimeNotes = [349.23, 440.00, 523.25, 659.25];

    chimeNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.22, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 1.2);
    });
  }
// 8. Обычный тактический удар (хлёсткий звук атаки)
  playAttackHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // 9. КРИТИЧЕСКИЙ УДАР (Стеклянный звон + глубокий саб-бас)
  playCritHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Звонкий крит-щелчок (высокие частоты)
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(1760, now);
    chime.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    chimeGain.gain.setValueAtTime(0.35, now);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    chime.connect(chimeGain);
    chimeGain.connect(this.ctx.destination);
    chime.start(now);
    chime.stop(now + 0.25);

    // Мощный низкий импульс удара
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(30, now + 0.28);
    subGain.gain.setValueAtTime(0.5, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.28);
  }

  // 10. Активация Щита / Защиты (гул силового поля)
  playShield() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    // Плавное нарастание и стабилизация как у силового поля
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.15);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 11. Коронный прием / Ультимейт (заряд энергии + взрыв)
  playUltimate() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Взлёт частоты (Riser)
    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(120, now);
    sweep.frequency.exponentialRampToValueAtTime(800, now + 0.25);
    sweepGain.gain.setValueAtTime(0.15, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    sweep.connect(sweepGain);
    sweepGain.connect(this.ctx.destination);
    sweep.start(now);
    sweep.stop(now + 0.25);

    // Мощный аккорд вспышки
    [440, 554.37, 659.25, 880].forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + 0.22);
      gain.gain.setValueAtTime(0.25, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22 + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + 0.22);
      osc.stop(now + 0.22 + 0.6);
    });
  }

  // 12. Разблокировка новой легенды в коллекции (сверкающий хрусталь)
  playCardUnlock() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66, 1479.98]; // Ре-мажорное арпеджио

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.2, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.5);
    });
  }

}

const sfx = new SoundController();