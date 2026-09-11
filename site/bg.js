"use strict";
/* SatQuery 3D background: perspective starfield + scroll parallax + drifting satellite */

(function () {
  const cv = document.getElementById('stars');
  const sat = document.getElementById('sat3d');
  const stage = document.getElementById('stage');
  const ctx = cv.getContext('2d');

  let W = 0, H = 0, DPR = 1;
  let stars = [];
  let shooting = [];
  let mouse = { x: 0, y: 0 };
  const FOV = 320;            // higher = less perspective
  let totalH = 1;

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    totalH = Math.max(document.body.scrollHeight, H + 1);
    seed();
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function seed() {
    const N = Math.floor((W * H) / 2600);
    stars = [];
    for (let i = 0; i < N; i++) {
      const z = rand(0.12, 1);
      stars.push({
        x: rand(-W, W * 2),
        y: rand(-H, H * 2),
        z,
        r: z < 0.3 ? rand(0.4, 0.8) : z < 0.6 ? rand(0.9, 1.6) : rand(1.7, 2.6),
        tw: rand(0, Math.PI * 2),
        ts: rand(0.5, 2.2),
        hue: Math.random() < 0.12 ? rand(0, 60) : Math.random() < 0.5 ? rand(180, 240) : 0,
        alpha: rand(0.35, 1),
      });
    }
  }

  /* advance a star in a closed orbiting pattern with depth parallax tied to scroll */
  function project(s, scrollY, time) {
    const depth = s.z;                                   // 1 = far
    const par = 1 - (depth - 0.12) * 0.62;               // near stars move fastest
    let x = s.x + mouse.x * (18 * par) + scrollY * 40 * par;
    let y = s.y + mouse.y * (14 * par) + time * 6 * par - scrollY * 130 * par;
    // closed loop: wrap on an extended band centered on the viewport
    const spanX = W * 2.4;
    const spanY = H * 3.2;
    x = ((x % spanX) + spanX) % spanX - W * 0.7;
    y = ((y % spanY) + spanY) % spanY - H * 1.1;

    const a = (x - W / 2) / depth;
    const b = (y - H / 2) / depth;
    const persp = FOV / (FOV + 120 * (1 - depth));       // near stars pop more
    return { x: W / 2 + a * persp, y: H / 2 + b * persp, persp, depth };
  }

  function draw(time, scrollY) {
    ctx.clearRect(0, 0, W, H);
    const px = (v) => Math.max(0.2, v * DPR);
    for (const s of stars) {
      const p = project(s, scrollY, time);
      if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) continue;
      const tw = 0.55 + 0.45 * Math.sin(time * s.ts + s.tw);
      const alpha = s.alpha * tw * (0.35 + 0.65 * p.depth) * (p.persp / 1.4);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s.r * (0.6 + 0.45 * p.persp), 0, Math.PI * 2);
      // soft glow for the biggest/brightest
      if (s.r > 1.8) {
        ctx.fillStyle = `hsla(${s.hue}, 60%, 78%, ${alpha * 0.14})`;
        ctx.arc(p.x, p.y, s.r * 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `hsla(${s.hue}, 70%, 82%, ${alpha})`;
      ctx.fill();
    }
    // occasional shooting star
    if (Math.random() < 0.012 && shooting.length < 2) {
      const sx = rand(10, W * 0.8), sy = rand(10, H * 0.5);
      const ang = rand(0.4, 0.8);
      shooting.push({ x: sx, y: sy, vx: Math.cos(ang) * rand(9, 14), vy: Math.sin(ang) * rand(5, 9), life: 1 });
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const m = shooting[i];
      m.x += m.vx; m.y += m.vy; m.life -= 0.035;
      if (m.life <= 0) { shooting.splice(i, 1); continue; }
      const g = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14);
      g.addColorStop(0, `rgba(255,255,255,${0.85 * m.life})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14); ctx.stroke();
    }
  }

  /* move the satellite with scroll + gentle float; rotate along its path */
  function moveSatellite(scrollY, time) {
    if (!sat || !stage) return;
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const prog = Math.min(1, scrollY / Math.max(1, docH - window.innerHeight));
    const top = Math.max(14, 24 - prog * 10);       // rises slightly as you scroll

    // travel on a shallow diagonal across the sky
    const tx = 14 + prog * 30;
    const ty = 24 - prog * 34 + Math.sin(time / 900) * 6;
    const rot = -prog * 26 + Math.sin(time / 1300) * 3;
    sat.style.transform =
      `translate3d(${(tx + Math.sin(time / 700) * 2).toFixed(1)}vw, ` +
      `${Math.max(10, ty + 6).toFixed(1)}vh, 0) ` +
      `rotate(${rot.toFixed(1)}deg)`;
  }

  function frame(time) {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    draw(time / 1000, scrollY);
    sat && moveSatellite(scrollY, time);
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