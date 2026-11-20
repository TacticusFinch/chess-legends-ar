// ================= ЗВУКОВОЙ ДВИЖОК WEB AUDIO API =================
// Все прежние звуки сохранены без изменений.
//
// Звуки квеста «Машина времени» (единственный источник правды —
// этот файл, в time-machine.js синтеза больше нет):
//   choir()        — хор приглашения (при открытии окна приветствия)
//   warp()         — варп-прыжок
//   arrival()      — мягкое прибытие в эпоху
//   crystal()      — кристалл времени
//   click()        — тихий тактильный клик
//   questVictory() — большой триумф после пятого соперника
//                    и после возвращения короны (уровень IV)
//   heroic()       — героический хор перед финальной партией
//
// Никаких внешних файлов: всё синтезируется на месте.
class SoundController {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.bus = null;
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.ctx = new AudioContext();

      // Шина: сюда приходит всё, что синтезируется
      this.bus = this.ctx.createGain();
      this.bus.gain.value = 0.42;

      // Компрессор-лимитер. Без него десять одновременных голосов
      // складываются в перегрузку, и на телефоне вместо аккорда
      // слышен треск и «кваканье».
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.comp = comp;

      // Короткий зал. Сухой синтез всегда звучит дёшево —
      // реверберация даёт объём и «дорогой» тембр.
      const reverb = this.ctx.createConvolver();
      reverb.buffer = this._makeReverb(2.0, 2.8);
      this.reverb = reverb;

      const wet = this.ctx.createGain();
      wet.gain.value = 0.26;
      this.wet = wet;

      this.bus.connect(comp);       // сухой сигнал
      this.bus.connect(reverb);     // посыл в зал
      reverb.connect(wet);
      wet.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.enabled = true;
    return this.ctx;
  }

  // Импульсный отклик зала: шум с экспоненциальным затуханием
  _makeReverb(dur, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * dur);
    const buffer = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buffer;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && (!this.ctx || this.ctx.state === 'suspended')) {
      this.init();
    }
    return this.enabled;
  }

  setEnabled(value) {
    this.enabled = !!value;
    if (this.enabled && (!this.ctx || this.ctx.state === 'suspended')) {
      this.init();
    }
  }

  // ==========================================================
  // НИЗКОУРОВНЕВЫЕ ХЕЛПЕРЫ (только для звуков квеста)
  // ==========================================================
  _tone(freq, delay, dur, opts) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const o = opts || {};
    const t0 = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);

    const peak = o.gain === undefined ? 0.12 : o.gain;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.min(0.14, dur * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  _noise(dur) {
    if (!this.ctx) return null;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Голос хора: пила + вибрато, медленная атака, длинный хвост.
  // Используется в heroic() и choir().
  _voice(freq, delay, dur, peak, vibratoHz) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const t0 = this.ctx.currentTime + (delay || 0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    // Треугольник вместо пилы: пила даёт резкие гармоники,
    // которые на маленьком динамике превращаются в треск.
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);

    lfo.frequency.value = vibratoHz || 4.6;
    lfoGain.gain.value = freq * 0.007;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, t0);
    filter.Q.value = 0.7;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak || 0.08), t0 + Math.min(0.6, dur * 0.35));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);

    osc.start(t0);
    osc.stop(t0 + dur + 0.1);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.1);
  }

  // Медный голос: треугольник + тихая октава, мягкая атака,
  // спад фильтра. Так фанфара звучит как труба, а не как писк.
  _brass(freq, delay, dur, peak) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const level = peak || 0.12;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(level * 0.55, t0 + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, t0);
    filter.frequency.exponentialRampToValueAtTime(1400, t0 + dur);
    filter.Q.value = 0.6;

    [1, 2.002].forEach((mult, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * mult, t0);
      g.gain.value = i === 0 ? 1 : 0.18;
      osc.connect(g);
      g.connect(filter);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    });

    filter.connect(gain);
    gain.connect(this.bus);
  }

  // Удар литавры: тон в слышимом диапазоне + шумовой щелчок.
  // Раньше уходил ниже 50 Гц — телефон это не воспроизводит,
  // и вместо удара слышался хрип.
  _timpani(delay, gainVal) {
    if (!this.enabled || !this.ctx || !this.bus) return;
    const t0 = this.ctx.currentTime + (delay || 0);

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(62, t0 + 0.4);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainVal || 0.5, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);

    osc.connect(gain);
    gain.connect(this.bus);
    osc.start(t0);
    osc.stop(t0 + 0.6);

    const buf = this._noise(0.05);
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t0);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime((gainVal || 0.5) * 0.35, t0);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.bus);
    src.start(t0);
  }

  // ==========================================================
  // 1. Стук деревянной шахматной фигуры (UI-клик)
  // ==========================================================
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

  // ==========================================================
  // 2. Триумфальные фанфары
  // ==========================================================
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

  // ==========================================================
  // 3. Захват карточки камерой (AR Lock-on)
  // ==========================================================
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

  // ==========================================================
  // 4. Правильный ход
  // ==========================================================
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

  // ==========================================================
  // 5. Зевок / Ошибка
  // ==========================================================
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

  // ==========================================================
  // 6. Шах и мат
  // ==========================================================
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

  // ==========================================================
  // 7. Мелодичный шахматный гонг/колокол при старте дуэли
  // ==========================================================
  playBattleStart() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
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

  // ==========================================================
  // 8. ПРЕМИАЛЬНЫЙ ТАКТИЧЕСКИЙ УДАР
  // ==========================================================
  playAttackHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(900, now);
    click.frequency.exponentialRampToValueAtTime(80, now + 0.035);
    clickGain.gain.setValueAtTime(0.5, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    click.connect(clickGain);
    clickGain.connect(this.ctx.destination);
    click.start(now);
    click.stop(now + 0.035);

    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(160, now);
    body.frequency.exponentialRampToValueAtTime(45, now + 0.14);
    bodyGain.gain.setValueAtTime(0.7, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    body.connect(bodyGain);
    bodyGain.connect(this.ctx.destination);
    body.start(now);
    body.stop(now + 0.14);
  }

  // ==========================================================
  // 9. КРИТИЧЕСКИЙ УДАР
  // ==========================================================
  playCritHit() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    [2093.00, 2637.02, 3135.96].forEach((f, i) => {
      const glass = this.ctx.createOscillator();
      const glassGain = this.ctx.createGain();
      glass.type = 'sine';
      glass.frequency.setValueAtTime(f, now + i * 0.015);
      glassGain.gain.setValueAtTime(0.25, now + i * 0.015);
      glassGain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.015 + 0.35);
      glass.connect(glassGain);
      glassGain.connect(this.ctx.destination);
      glass.start(now + i * 0.015);
      glass.stop(now + i * 0.015 + 0.35);
    });

    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, now);
    sub.frequency.exponentialRampToValueAtTime(32, now + 0.45);
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(this.ctx.destination);
    sub.start(now);
    sub.stop(now + 0.45);

    const buffLen = Math.floor(this.ctx.sampleRate * 0.08);
    const buf = this.ctx.createBuffer(1, buffLen, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < buffLen; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (buffLen * 0.3));
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3500, now);
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);
    noise.start(now);
  }

  // ==========================================================
  // 10. АКТИВАЦИЯ ЩИТА / ЗАЩИТЫ
  // ==========================================================
  playShield() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    [369.99, 554.37, 880.00].forEach((freq, idx) => {
      const bell = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bell.type = 'sine';
      bell.frequency.setValueAtTime(freq, now);

      bellGain.gain.setValueAtTime(0.001, now);
      bellGain.gain.linearRampToValueAtTime(0.2 / (idx + 1), now + 0.04);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      bell.connect(bellGain);
      bellGain.connect(this.ctx.destination);
      bell.start(now);
      bell.stop(now + 0.6);
    });
  }

  // ==========================================================
  // 11. КОРОННЫЙ ПРИЕМ / УЛЬТИМЕЙТ
  // ==========================================================
  playUltimate() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const sweep = this.ctx.createOscillator();
    const sweepGain = this.ctx.createGain();
    sweep.type = 'sawtooth';
    sweep.frequency.setValueAtTime(90, now);
    sweep.frequency.exponentialRampToValueAtTime(950, now + 0.32);

    const sweepFilter = this.ctx.createBiquadFilter();
    sweepFilter.type = 'lowpass';
    sweepFilter.frequency.setValueAtTime(300, now);
    sweepFilter.frequency.exponentialRampToValueAtTime(4500, now + 0.32);

    sweepGain.gain.setValueAtTime(0.01, now);
    sweepGain.gain.linearRampToValueAtTime(0.28, now + 0.28);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    sweep.connect(sweepFilter);
    sweepFilter.connect(sweepGain);
    sweepGain.connect(this.ctx.destination);
    sweep.start(now);
    sweep.stop(now + 0.35);

    const chordTime = now + 0.30;
    const chord = [220, 277.18, 329.63, 440, 659.25];
    chord.forEach((f) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, chordTime);

      gain.gain.setValueAtTime(0.22, chordTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, chordTime + 0.85);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(chordTime);
      osc.stop(chordTime + 0.85);
    });
  }

  // ==========================================================
  // 12. Разблокировка новой легенды в коллекции
  // ==========================================================
  playCardUnlock() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00, 1174.66, 1479.98];

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

  // ==========================================================
  // 13. УСПЕШНЫЙ УРОН ПО СОПЕРНИКУ
  // ==========================================================
  playDamageDealt() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  // ==========================================================
  // 14. ПОЛУЧЕННЫЙ УРОН
  // ==========================================================
  playDamageTaken() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.linearRampToValueAtTime(35, now + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.35);

    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // ==========================================================
  // 15. ХОР ПРИГЛАШЕНИЯ (квест «Машина времени»)
  // Тёплый четырёхголосный аккорд с вибрато и «воздухом».
  // ==========================================================
  choir() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;
    const notes = [261.63, 329.63, 392.00, 523.25];

    notes.forEach((freq, i) => {
      const t0 = this.ctx.currentTime + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = i % 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);

      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 4.4 + i * 0.25;
      lfoGain.gain.value = freq * 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.13, t0 + 1.0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);

      osc.connect(gain);
      gain.connect(this.bus);
      osc.start(t0);
      osc.stop(t0 + 3.6);
      lfo.start(t0);
      lfo.stop(t0 + 3.6);
    });

    this._tone(1046.5, 1.15, 1.8, { gain: 0.05 });
    this._tone(1318.5, 1.31, 1.8, { gain: 0.045 });
  }

  // ==========================================================
  // 16. ВАРП-ПРЫЖОК
  // Шумовой свист + низкий спуск + «пинг» прибытия.
  // ==========================================================
  warp() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    const dur = 2.4;
    const buffer = this._noise(dur);
    if (!buffer) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(280, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4200, this.ctx.currentTime + dur);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bus);
    src.start();

    const osc = this.ctx.createOscillator();
    const og = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 1.8);
    og.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.16, this.ctx.currentTime + 0.3);
    og.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 2.2);
    osc.connect(og);
    og.connect(this.bus);
    osc.start();
    osc.stop(this.ctx.currentTime + 2.3);

    this._tone(880, 2.0, 0.9, { gain: 0.1 });
    this._tone(1320, 2.12, 0.9, { gain: 0.07 });
  }

  // ==========================================================
  // 17. ПРИБЫТИЕ В ЭПОХУ
  // Мягкий аккорд: «зрение проясняется».
  // ==========================================================
  arrival() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;
    this._tone(392, 0, 1.4, { gain: 0.12 });
    this._tone(587.33, 0.12, 1.4, { gain: 0.09 });
    this._tone(784, 0.24, 1.6, { gain: 0.07 });
  }

  // ==========================================================
  // 18. КРИСТАЛЛ ВРЕМЕНИ
  // ==========================================================
  crystal() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;
    this._tone(1567.98, 0, 0.12, { gain: 0.08 });
    this._tone(2093, 0.07, 0.2, { gain: 0.05 });
  }

  // ==========================================================
  // 19. ТИХИЙ КЛИК
  // ==========================================================
  click() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;
    this._tone(1180, 0, 0.05, { gain: 0.04 });
  }

  // ==========================================================
  // 20. БОЛЬШОЙ ТРИУМФ
  // Пятый соперник повержен. Длится около четырёх секунд.
  // ==========================================================
  questVictory() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    // 1. Литавры: три удара, как перед выходом на сцену
    this._timpani(0.00, 0.5);
    this._timpani(0.44, 0.34);
    this._timpani(0.88, 0.55);

    // 2. Фанфары: до — ми — соль — до — ми
    const fanfare = [
      { f: 261.63, t: 0.10, d: 0.40 },
      { f: 329.63, t: 0.36, d: 0.40 },
      { f: 392.00, t: 0.62, d: 0.40 },
      { f: 523.25, t: 0.88, d: 0.65 },
      { f: 659.25, t: 1.30, d: 1.30 }
    ];
    fanfare.forEach(n => this._brass(n.f, n.t, n.d, 0.12));

    // 3. Аккорд на пике — мягко, синусами
    [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
      this._tone(f, 1.42 + i * 0.03, 2.4, { gain: 0.05, type: 'sine' });
    });

    // 4. Колокольчики — «искры»
    this._tone(1046.50, 1.65, 1.4, { gain: 0.045 });
    this._tone(1567.98, 1.85, 1.1, { gain: 0.028 });
  }

  // ==========================================================
  // 19b. ЗАДАЧА НА АТАКУ РЕШЕНА
  // Короткая восходящая фанфара: две трубы и аккорд.
  // Звучит как «попадание», а не как «ещё один клик».
  // ==========================================================
  tacticWin() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    this._brass(392.00, 0.00, 0.30, 0.11);
    this._brass(523.25, 0.11, 0.30, 0.12);
    this._brass(783.99, 0.22, 0.85, 0.13);

    [523.25, 659.25, 783.99].forEach((f, i) => {
      this._tone(f, 0.30 + i * 0.02, 1.3, { gain: 0.045, type: 'sine' });
    });

    this._tone(1567.98, 0.48, 0.9, { gain: 0.035 });
  }

  // ==========================================================
  // 19c. ЗАДАЧА НА ЗАЩИТУ РЕШЕНА
  // Гонг: низкий удар, два голоса и долгий колокол.
  // Звучит как «стена выдержала».
  // ==========================================================
  shieldHold() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    this._timpani(0, 0.34);
    this._voice(220.00, 0.00, 2.0, 0.055, 3.8);
    this._voice(329.63, 0.12, 1.9, 0.045, 4.2);

    this._tone(880.00, 0.22, 1.5, { gain: 0.055 });
    this._tone(1318.51, 0.42, 1.1, { gain: 0.032 });
  }

  // ==========================================================
  // 20c. АПЛОДИСМЕНТЫ ЗАЛА
  // Гул толпы + десятки коротких хлопков со случайной
  // задержкой, тембром и громкостью. Никаких файлов.
  // ==========================================================
  applause() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    const dur = 3.4;
    const t0 = this.ctx.currentTime;

    // 1. Гул зала — шум через lowpass, медленно поднимается
    const bed = this._noise(dur);
    if (bed) {
      const src = this.ctx.createBufferSource();
      src.buffer = bed;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 850;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.055, t0 + 0.5);
      g.gain.linearRampToValueAtTime(0.045, t0 + dur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(lp);
      lp.connect(g);
      g.connect(this.bus);
      src.start(t0);
    }

    // 2. Хлопки: 64 всплеска шума с полосовым фильтром
    for (let i = 0; i < 64; i++) {
      const t = t0 + 0.12 + Math.random() * (dur - 0.7);
      const buf = this._noise(0.045);
      if (!buf) break;

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100 + Math.random() * 1900;
      bp.Q.value = 1.1;

      const g = this.ctx.createGain();
      const peak = 0.035 + Math.random() * 0.075;
      g.gain.setValueAtTime(peak, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      src.connect(bp);
      bp.connect(g);
      g.connect(this.bus);
      src.start(t);
    }
  }

  // ==========================================================
  // 20d. БОЛЬШОЙ ФИНАЛ
  // Победа после слова хранителя: триумф + аплодисменты.
  // Аплодисменты входят с задержкой — сначала удар, потом зал.
  // ==========================================================
  grandFinale() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    this.questVictory();

    const self = this;
    setTimeout(function () { self.applause(); }, 620);
    setTimeout(function () {
      if (!self.enabled || !self.ctx || !self.bus) return;
      // финальный аккорд поверх аплодисментов
      [523.25, 659.25, 783.99, 1046.50].forEach(function (f, i) {
        self._tone(f, i * 0.04, 2.6, { gain: 0.045, type: 'sine' });
      });
    }, 1500);
  }

  // ==========================================================
  // 21b. ТАЙНА ПЕРЕД ФИНАЛОМ
  // Не героика, а предчувствие: низкий гул, тритон (интервал
  // тревоги), редкие далёкие колокола и тихий подъём воздуха.
  // Ощущение: дверь открыта, за ней что-то очень старое.
  // ==========================================================
  mystery() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    // 1. Низкий гул — ми первой октавы, медленное вибрато
    this._voice(82.41, 0, 5.2, 0.085, 0.9);
    this._voice(123.47, 0.15, 4.8, 0.045, 1.1);

    // 2. Тритон — си-бемоль над ми: интервал, который всегда
    //    звучит как вопрос без ответа
    this._voice(116.54, 0.5, 4.2, 0.032, 0.8);

    // 3. Воздух: шум сквозь узкий фильтр, поднимается и уходит
    const air = this._noise(4.6);
    if (air) {
      const src = this.ctx.createBufferSource();
      src.buffer = air;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(420, this.ctx.currentTime);
      bp.frequency.exponentialRampToValueAtTime(1900, this.ctx.currentTime + 4.2);
      bp.Q.value = 1.4;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 4.6);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.bus);
      src.start(this.ctx.currentTime);
    }

    // 4. Далёкие колокола — редкие, с длинным хвостом
    this._tone(659.25, 0.9, 2.6, { gain: 0.045, type: 'sine' });
    this._tone(987.77, 2.1, 2.2, { gain: 0.03, type: 'sine' });
    this._tone(493.88, 3.0, 2.4, { gain: 0.035, type: 'sine' });

    // 5. Два мягких удара в глубине — как шаги
    this._timpani(0.05, 0.22);
    this._timpani(2.35, 0.16);
  }

  // ==========================================================
  // 20b. КОРОНА ВОЗВРАЩЕНА — короткий тёплый перезвон
  // Специально НЕ фанфары: они уже отзвучали после пятого
  // соперника. Здесь только три колокола в высоком регистре,
  // полторы секунды, без литавр и труб.
  // ==========================================================
  crown() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    const bells = [
      { f: 783.99, t: 0.00, d: 1.5 },
      { f: 1046.50, t: 0.16, d: 1.4 },
      { f: 1318.51, t: 0.32, d: 1.2 }
    ];

    bells.forEach(b => {
      this._tone(b.f, b.t, b.d, { gain: 0.09, type: 'sine' });
      this._tone(b.f * 2.01, b.t, b.d * 0.6, { gain: 0.022 });
    });

    // мягкая опора внизу — чтобы перезвон не висел в воздухе
    this._tone(261.63, 0, 1.2, { gain: 0.05, type: 'triangle' });
  }

  // ==========================================================
  // 21. ГЕРОИЧЕСКИЙ ХОР ПЕРЕД ФИНАЛЬНОЙ ПАРТИЕЙ
  // Низкий гул, хоровые голоса с вибрато, трубы.
  // Ощущение: «сейчас начнётся то, к чему ты шёл весь путь».
  // ==========================================================
  heroic() {
    this.init();
    if (!this.enabled || !this.ctx || !this.bus) return;

    // 1. Земля: два удара и низкий гул в слышимом диапазоне
    this._timpani(0.00, 0.45);
    this._timpani(0.55, 0.32);
    this._tone(110.00, 0, 3.8, { gain: 0.10, type: 'triangle' });
    this._tone(164.81, 0.12, 3.4, { gain: 0.06, type: 'triangle' });

    // 2. Хор: ля минор, четыре голоса входят по очереди
    const choir = [
      { f: 220.00, t: 0.30, d: 3.8 },
      { f: 261.63, t: 0.55, d: 3.6 },
      { f: 329.63, t: 0.80, d: 3.4 },
      { f: 440.00, t: 1.05, d: 3.2 }
    ];
    choir.forEach((v, i) => this._voice(v.f, v.t, v.d, 0.07, 4.2 + i * 0.3));

    // 3. Второй слой — квартой выше и тише: «эхо в сводах»
    choir.forEach((v, i) => this._voice(v.f * 1.5, v.t + 0.28, v.d * 0.75, 0.026, 5.0 + i * 0.2));

    // 4. Трубы: короткий мотив поверх хора
    this._brass(440.00, 1.30, 0.35, 0.10);
    this._brass(523.25, 1.62, 0.35, 0.10);
    this._brass(659.25, 1.94, 0.90, 0.11);

    // 5. Сияние на выходе
    this._tone(1046.50, 2.6, 1.8, { gain: 0.04 });
  }
}

const sfx = new SoundController();