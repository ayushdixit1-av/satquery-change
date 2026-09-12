"use strict";
/* SatQuery 3D background: realistic universe with parallax depth.
   Spectral star colors, Milky Way band, nebulae, a ringed planet, comets,
   and a scroll-driven satellite. Content always stays above the scene. */

(function () {
  const cv = document.getElementById('stars');
  const ctx = cv.getContext('2d');
  const sat = document.getElementById('sat3d');
  const stage = document.getElementById('stage');
  const planetEl = document.getElementById('planet');

  let W = 0, H = 0, DPR = 1;
  let stars = [], nebulae = [];
  let shooting = [];
  let mouse = { x: 0, y: 0 };
  const FOV = 330;
  let time = 0;

  /* Spectral class -> realistic star color (B-V inspired). Ratio ~ O:0.1 B:0.07 A:0.6 F:0.6 G:0.5 K:0.7 M:0.34 */
  const SPEC = [
    { t: 'o', w: 0.010, rgb: [183, 205, 255], bv: 0.98 },   // blue-white giants
    { t: 'b', w: 0.007, rgb: [172, 198, 255], bv: 0.94 },
    { t: 'a', w: 0.055, rgb: [205, 222, 255], bv: 0.90 },
    { t: 'f', w: 0.060, rgb: [246, 245, 255], bv: 0.78 },
    { t: 'g', w: 0.070, rgb: [255, 244, 220], bv: 0.65 },   // our sun
    { t: 'k', w: 0.130, rgb: [255, 214, 150], bv: 0.48 },
    { t: 'm', w: 0.370, rgb: [255, 168, 110], bv: 0.35 },   // red dwarfs
  ];

  function pickSpec() {
    let r = Math.random(), acc = 0;
    for (const s of SPEC) { acc += s.w; if (r < acc) return s; }
    return SPEC[SPEC.length - 1];
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  function seed() {
    // star density: richer than before, plus a dense Milky Way band
    const N = Math.floor((W * H) / 2000);
    stars = [];
    for (let i = 0; i < N; i++) {
      const z = rand(0.1, 1);
      const s = pickSpec();
      // Milky Way: extra stars clustered along a diagonal band
      let mw = 0;
      const bw = rand(-1, 1);
      if (bw > 0.55) mw = 1;
      const r = z < 0.3 ? rand(0.3, 0.7) : z < 0.6 ? rand(0.7, 1.5) : rand(1.4, 2.4);
      stars.push({
        x: rand(-W, W * 2), y: rand(-H, H * 2), z,
        r, tw: rand(0, Math.PI * 2), ts: rand(0.4, 2.4),
        rgb: s.rgb, mw, alpha: rand(0.4, 1),
        spike: s.bv > 0.90 && Math.random() < 0.14,           // bright stars get diffraction spikes
      });
    }
    // giant blooming stars that twinkle with a halo
    for (let i = 0; i < Math.min(14, N / 60); i++) {
      stars.push({
        x: rand(-W, W * 2), y: rand(-H, H * 2), z: rand(0.6, 1),
        r: rand(2.6, 4.2), tw: rand(0, 6.28), ts: rand(0.3, 0.9),
        rgb: [235, 225, 255], mw: 0, alpha: 1, spike: true, halo: true,
      });
    }
    nebulae = [];
    for (let i = 0; i < 5; i++) {
      const hue = Math.random();
      nebulae.push({
        x: rand(-W * 0.5, W * 1.5), y: rand(-H * 0.5, H * 1.5),
        rx: rand(W * 0.6, W * 1.3), ry: rand(H * 0.4, H * 0.9),
        color: hue < 0.34 ? [255, 172, 150] : hue < 0.67 ? [150, 178, 255] : [196, 150, 255],
        alpha: rand(0.05, 0.11),
      });
    }
  }

  function project(s, scrollY) {
    const depth = s.z;
    const par = 1 - (depth - 0.1) * 0.6;
    let x = s.x + mouse.x * (16 * par) + scrollY * 46 * par;
    let y = s.y + mouse.y * (12 * par) + time * 5 * par - scrollY * 150 * par;
    const spanX = W * 2.4, spanY = H * 3.2;
    x = ((x % spanX) + spanX) % spanX - W * 0.7;
    y = ((y % spanY) + spanY) % spanY - H * 1.1;
    const a = (x - W / 2) / depth, b = (y - H / 2) / depth;
    const persp = FOV / (FOV + 120 * (1 - depth));
    return { x: W / 2 + a * persp, y: H / 2 + b * persp, persp, depth };
  }

  function drawNebulae(scrollY) {
    const drift = scrollY * 0.04;
    for (const n of nebulae) {
      let nx = n.x;
      let ny = n.y - drift;
      nx = ((nx % (W * 2)) + W * 2) % (W * 2) - W * 0.5;
      ny = ((ny % (H * 2)) + H * 2) % (H * 2) - H * 0.5;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, Math.max(n.rx, n.ry));
      g.addColorStop(0, `rgba(${n.color[0]},${n.color[1]},${n.color[2]},${n.alpha})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(nx, ny, n.rx, n.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStar(s, scrollY) {
    const p = project(s, scrollY);
    if (p.x < -24 || p.x > W + 24 || p.y < -24 || p.y > H + 24) return;
    const tw = 0.55 + 0.45 * Math.sin(time * s.ts + s.tw);
    const a = s.alpha * tw * (0.3 + 0.7 * p.depth) * (p.persp / 1.5);
    const rad = s.r * (0.6 + 0.5 * p.persp);
    const [R, G, B] = s.rgb;

    if (s.halo && a > 0.25) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad * 7);
      g.addColorStop(0, `rgba(${R},${G},${B},${0.30 * a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad * 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = `rgba(${R},${G},${B},${Math.min(1, a)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.fill();

    if (s.spike && a > 0.5) {
      ctx.strokeStyle = `rgba(${R},${G},${B},${0.4 * a})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x - rad * 3, p.y); ctx.lineTo(p.x + rad * 3, p.y);
      ctx.moveTo(p.x, p.y - rad * 3); ctx.lineTo(p.x, p.y + rad * 3);
      ctx.stroke();
    }
  }

  function draw(timeSec, scrollY) {
    ctx.clearRect(0, 0, W, H);
    drawNebulae(scrollY);
    // Milky Way dust band (very subtle overall sheen)
    const mwg = ctx.createLinearGradient(0, 0, W, H);
    mwg.addColorStop(0, 'rgba(150,170,255,0.035)');
    mwg.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    mwg.addColorStop(1, 'rgba(150,170,255,0.035)');
    ctx.fillStyle = mwg;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) drawStar(s, scrollY);

    // comets
    if (shooting.length < 3 && Math.random() < 0.02) {
      const ang = rand(0.35, 0.85);
      shooting.push({
        x: rand(10, W * 0.8), y: rand(10, H * 0.5),
        vx: Math.cos(ang) * rand(10, 16), vy: Math.sin(ang) * rand(6, 10),
        life: 1, tail: rand(16, 26),
      });
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const m = shooting[i];
      m.x += m.vx; m.y += m.vy; m.life -= 0.03;
      if (m.life <= 0) { shooting.splice(i, 1); continue; }
      const head = m.x, hy = m.y;
      const g = ctx.createLinearGradient(head, hy, head - m.vx * m.tail, hy - m.vy * m.tail);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * m.life})`);
      g.addColorStop(0.4, `rgba(160,190,255,${0.35 * m.life})`);
      g.addColorStop(1, 'rgba(120,150,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(head, hy);
      ctx.lineTo(head - m.vx * m.tail, hy - m.vy * m.tail);
      ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.95 * m.life})`;
      ctx.beginPath(); ctx.arc(head, hy, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function moveSatellite(scrollY) {
    if (!sat || !stage) return;
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const prog = Math.min(1, scrollY / Math.max(1, docH - window.innerHeight));
    // right-hand sky so it never crowds the centered text column
    const tx = 70 - prog * 18;
    const ty = 7 + prog * 16 + Math.sin(time / 900) * 5;
    const rot = -prog * 22 + Math.sin(time / 1300) * 3;
    sat.style.transform =
      `translate3d(${tx}vw, ${Math.min(80, Math.max(5, ty))}vh, 0) rotate(${rot}deg)`;
    sat.style.opacity = 0.92;
  }

  function movePlanet(scrollY) {
    if (!planetEl) return;
    const prog = Math.min(1, scrollY / Math.max(1, document.documentElement.scrollHeight - window.innerHeight));
    const px = 4 - prog * 1;
    const py = 16 + prog * 4 + Math.sin(time / 1500) * 2;
    planetEl.style.transform =
      `translate3d(${px}vw, ${Math.min(90, Math.max(2, py))}vh, 0) rotate(${time / 20000 % 360}deg)`;
  }

  function frame(now) {
    time = now;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    draw(time / 1000, scrollY);
    moveSatellite(scrollY);
    movePlanet(scrollY);
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / W - 0.5) * 2;
    mouse.y = (e.clientY / H - 0.5) * 2;
  });

  resize();
  requestAnimationFrame(frame);
})();