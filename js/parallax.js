/* ==========================================================
   ИНТЕРАКТИВНЫЙ 2.5D ПАРАЛЛАКС ДЛЯ МОДАЛЬНЫХ ОКОН
   ========================================================== */
const LuxuryParallax = {
  currentTiltX: 0,
  currentTiltY: 0,
  targetTiltX: 0,
  targetTiltY: 0,
  activeCard: null,
  glareEl: null,
  isListening: false,

  init() {
    // Слушаем открытие модалок
    const observer = new MutationObserver(() => {
      const openModal = document.querySelector('.modal-overlay.active .modal-card');
      if (openModal && openModal !== this.activeCard) {
        this.bindCard(openModal);
      } else if (!openModal) {
        this.activeCard = null;
      }
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
      observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
    });

    this.initSensors();
    this.renderLoop();
  },

  bindCard(card) {
    this.activeCard = card;
    if (!card.querySelector('.parallax-glare')) {
      const glare = document.createElement('div');
      glare.className = 'parallax-glare';
      card.appendChild(glare);
    }
    this.glareEl = card.querySelector('.parallax-glare');
    if (this.glareEl) this.glareEl.style.opacity = '1';
  },

  initSensors() {
    // 1. Гироскоп мобильного телефона
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        if (!this.activeCard || e.gamma === null) return;
        // Ограничиваем угол наклона до 18 градусов
        this.targetTiltX = Math.max(-18, Math.min(18, e.gamma)); 
        this.targetTiltY = Math.max(-18, Math.min(18, (e.beta - 45))); 
      });
    }

    // 2. Движение пальца по экрану или мыши (для надежности на любых ОС)
    window.addEventListener('mousemove', (e) => {
      if (!this.activeCard) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      this.targetTiltX = ((e.clientX - cx) / cx) * 16;
      this.targetTiltY = -((e.clientY - cy) / cy) * 16;
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.activeCard || !e.touches[0]) return;
      const touch = e.touches[0];
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      this.targetTiltX = ((touch.clientX - cx) / cx) * 12;
      this.targetTiltY = -((touch.clientY - cy) / cy) * 12;
    }, { passive: true });
  },

  renderLoop() {
    // Плавная интерполяция движения (LERP 0.1)
    this.currentTiltX += (this.targetTiltX - this.currentTiltX) * 0.1;
    this.currentTiltY += (this.targetTiltY - this.currentTiltY) * 0.1;

    if (this.activeCard) {
      const rx = -this.currentTiltY.toFixed(2);
      const ry = this.currentTiltX.toFixed(2);

      this.activeCard.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg)`;

      // Смещение блика света
      if (this.glareEl) {
        const glareX = 50 + this.currentTiltX * 2.2;
        const glareY = 50 + this.currentTiltY * 2.2;
        this.glareEl.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.16) 0%, transparent 65%)`;
      }
    }

    requestAnimationFrame(() => this.renderLoop());
  }
};

// Запуск после загрузки DOM
document.addEventListener('DOMContentLoaded', () => LuxuryParallax.init());