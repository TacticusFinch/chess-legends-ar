/* ==========================================================
   КВАНТОВЫЙ РАЗЛОМ — Canvas 2D, псевдо-3D
   Туннель частиц с перспективой, светящееся ядро и
   наклонные кольца горизонта. Без библиотек.
   ========================================================== */
(function (global) {
  'use strict';

  function QuantumRift(canvas, options) {
    if (!canvas) throw new Error('QuantumRift: нужен canvas');

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = Object.assign({
      count: 560,
      depth: 1000,
      fov: 640,
      camDist: 360,
      color: '79, 209, 224',
      color2: '143, 214, 148',
      speed: 1
    }, options || {});

    this.raf = null;
    this.startTime = 0;
    this.particles = [];
    this.w = 0;
    this.h = 0;
    this.cx = 0;
    this.cy = 0;
    this.base = 0;

    this.build();
    this.resize();

    this.onResize = this.resize.bind(this);
    global.addEventListener('resize', this.onResize);
  }

  QuantumRift.prototype.build = function () {
    this.particles = [];
    for (var i = 0; i < this.opts.count; i++) {
      this.particles.push({
        z0: Math.random() * this.opts.depth,
        angle: Math.random() * Math.PI * 2,
        radius: 0.28 + Math.random() * 0.72,
        spin: (0.12 + Math.random() * 0.5) * (Math.random() > 0.5 ? 1 : -1),
        speed: 0.55 + Math.random() * 0.9,
        size: 0.7 + Math.random() * 1.6,
        alpha: 0.35 + Math.random() * 0.65,
        warm: Math.random() > 0.82
      });
    }
  };

  QuantumRift.prototype.resize = function () {
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var rect = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width));
    var h = Math.max(1, Math.round(rect.height));

    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.w = w;
    this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
    this.base = Math.min(w, h);
  };

  QuantumRift.prototype.start = function () {
    if (this.raf) return;

    var self = this;
    this.startTime = performance.now();

    var loop = function (now) {
      if (!self.canvas.isConnected) {
        self.stop();
        return;
      }
      if (!self.w || !self.h) self.resize();
      self.draw(now);
      self.raf = global.requestAnimationFrame(loop);
    };

    this.raf = global.requestAnimationFrame(loop);
  };

  QuantumRift.prototype.stop = function () {
    if (this.raf) {
      global.cancelAnimationFrame(this.raf);
      this.raf = null;
    }
  };

  QuantumRift.prototype.destroy = function () {
    this.stop();
    global.removeEventListener('resize', this.onResize);
  };

  QuantumRift.prototype.draw = function (now) {
    var c = this.ctx;
    var w = this.w;
    var h = this.h;
    var cx = this.cx;
    var cy = this.cy;
    var t = (now - this.startTime) / 1000;
    var o = this.opts;
    var depth = o.depth;
    var fov = o.fov;
    var camDist = o.camDist;

    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = 'lighter';

    /* 1. ядро разлома */
    var pulse = 0.86 + Math.sin(t * 1.7) * 0.14;
    var coreR = this.base * 0.30 * pulse;
    var g = c.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.14, 'rgba(' + o.color + ',0.5)');
    g.addColorStop(0.45, 'rgba(' + o.color + ',0.14)');
    g.addColorStop(1, 'rgba(' + o.color + ',0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, coreR, 0, Math.PI * 2);
    c.fill();

    /* 2. туннель частиц */
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var z = (p.z0 + t * p.speed * 130 * o.speed) % depth;
      var zz = z - depth * 0.4;
      var s = fov / (fov + zz + camDist);
      if (s <= 0.03) continue;

      var ang = p.angle + t * p.spin;
      var rad = p.radius * this.base * 0.46 * (0.3 + 0.7 * (z / depth));
      var x = cx + Math.cos(ang) * rad * s;
      var y = cy + Math.sin(ang) * rad * s * 0.94;

      var fade = 1 - z / depth;
      var alpha = Math.min(1, fade * 1.5) * p.alpha;
      var size = Math.max(0.35, p.size * s * 1.5);

      c.fillStyle = 'rgba(' + (p.warm ? o.color2 : o.color) + ',' + alpha.toFixed(3) + ')';
      c.beginPath();
      c.arc(x, y, size, 0, Math.PI * 2);
      c.fill();

      /* штрих скорости у ближних частиц */
      if (z < depth * 0.45) {
        var s2 = fov / (fov + zz + 60 + camDist);
        var x2 = cx + Math.cos(ang) * rad * s2;
        var y2 = cy + Math.sin(ang) * rad * s2 * 0.94;
        c.strokeStyle = 'rgba(' + o.color + ',' + (alpha * 0.35).toFixed(3) + ')';
        c.lineWidth = Math.max(0.5, size * 0.7);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x2, y2);
        c.stroke();
      }
    }

    /* 3. горизонт: два наклонных кольца */
    c.globalCompositeOperation = 'source-over';
    var ringR = this.base * 0.34;

    for (var k = 0; k < 2; k++) {
      var rot = t * (k === 0 ? 0.22 : -0.16) + k * 1.1;
      c.save();
      c.translate(cx, cy);
      c.rotate(rot);
      c.strokeStyle = 'rgba(' + o.color + ',' + (k === 0 ? 0.22 : 0.14) + ')';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, 0, ringR, ringR * 0.34, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }

    /* 4. гексагональные контуры — как в HUD-референсе */
    for (var h = 0; h < 2; h++) {
      var hexR = this.base * (h === 0 ? 0.44 : 0.5);
      var hexRot = t * (h === 0 ? 0.14 : -0.09) + h * 0.5;
      c.save();
      c.translate(cx, cy);
      c.rotate(hexRot);
      c.strokeStyle = 'rgba(' + (h === 0 ? o.color : o.color2) + ',' + (h === 0 ? 0.16 : 0.1) + ')';
      c.lineWidth = 1;
      c.beginPath();
      for (var v = 0; v < 6; v++) {
        var a = (Math.PI / 3) * v - Math.PI / 2;
        var px = Math.cos(a) * hexR;
        var py = Math.sin(a) * hexR;
        if (v === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
      c.stroke();
      c.restore();
    }
  };

  global.QuantumRift = QuantumRift;
})(window);