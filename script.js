(() => {
  'use strict';

  // ====== STATE ======
  const STORAGE_KEY = 'spinwheel.items.v1';
  const DEFAULT_ITEMS = ['Pizza', 'Sushi', 'Burgare', 'Tacos', 'Pasta', 'Sallad'];

  /** @type {string[]} */
  let items = loadItems();
  let rotation = 0; // current rotation in radians
  let isSpinning = false;
  let lastTickSegment = -1;

  // ====== DOM ======
  const canvas = document.getElementById('wheel');
  const ctx = canvas.getContext('2d');
  const spinBtn = document.getElementById('spinBtn');
  const itemInput = document.getElementById('itemInput');
  const addForm = document.getElementById('addForm');
  const itemsList = document.getElementById('itemsList');
  const countEl = document.getElementById('count');
  const clearBtn = document.getElementById('clearBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const resultModal = document.getElementById('resultModal');
  const resultText = document.getElementById('resultText');
  const closeResult = document.getElementById('closeResult');
  const removeWinnerBtn = document.getElementById('removeWinner');
  const pointer = document.querySelector('.pointer');
  const confettiCanvas = document.getElementById('confetti');
  const confettiCtx = confettiCanvas.getContext('2d');

  // ====== STORAGE ======
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [...DEFAULT_ITEMS];
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (_) {}
  }

  // ====== COLORS ======
  // Generate harmonious colors evenly distributed in HSL
  function colorFor(index, total) {
    const hue = (index * 360) / Math.max(total, 1);
    // Alternate slightly between two saturations/lightnesses for visual interest
    const sat = 70 + (index % 2) * 8;
    const light = 58 + (index % 3) * 4;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  // ====== WHEEL RENDERING ======
  // We pre-render the wheel to an offscreen canvas once whenever items / size
  // change. Each animation frame just clears, rotates, and blits the cache —
  // no gradients, no text measurement, no shadows per frame.
  const wheelCache = document.createElement('canvas');
  const wheelCacheCtx = wheelCache.getContext('2d');
  let wheelCacheSize = 0;
  let dprCached = 1;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    dprCached = dpr;
    const rect = canvas.getBoundingClientRect();
    const size = Math.floor(rect.width);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wheelCacheSize = size;
    refreshWheel();
  }

  function rebuildWheelCache() {
    const size = wheelCacheSize;
    if (!size) return;
    const dpr = dprCached;
    wheelCache.width = size * dpr;
    wheelCache.height = size * dpr;
    const c = wheelCacheCtx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);

    if (items.length === 0) return;

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 6;
    const n = items.length;
    const segAngle = (Math.PI * 2) / n;

    c.save();
    c.translate(cx, cy);

    // Segments
    for (let i = 0; i < n; i++) {
      const start = i * segAngle - Math.PI / 2;
      const end = start + segAngle;
      const baseColor = colorFor(i, n);

      const grad = c.createRadialGradient(0, 0, radius * 0.15, 0, 0, radius);
      grad.addColorStop(0, lighten(baseColor, 12));
      grad.addColorStop(1, darken(baseColor, 8));

      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, radius, start, end);
      c.closePath();
      c.fillStyle = grad;
      c.fill();

      c.strokeStyle = 'rgba(0, 0, 0, 0.18)';
      c.lineWidth = 1;
      c.stroke();
    }

    // Inner shine
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    const shine = c.createRadialGradient(0, -radius * 0.3, radius * 0.1, 0, 0, radius);
    shine.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    shine.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
    c.fillStyle = shine;
    c.fill();

    // Labels
    for (let i = 0; i < n; i++) {
      const mid = i * segAngle - Math.PI / 2 + segAngle / 2;
      drawLabel(c, items[i], mid, radius, segAngle);
    }

    // Outer rims
    c.beginPath();
    c.arc(0, 0, radius, 0, Math.PI * 2);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    c.stroke();

    c.beginPath();
    c.arc(0, 0, radius - 2, 0, Math.PI * 2);
    c.lineWidth = 1;
    c.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    c.stroke();

    // Tick dots at segment edges
    if (n > 1 && n <= 60) {
      for (let i = 0; i < n; i++) {
        const a = i * segAngle - Math.PI / 2;
        const tx = Math.cos(a) * (radius - 10);
        const ty = Math.sin(a) * (radius - 10);
        c.beginPath();
        c.arc(tx, ty, 2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255, 255, 255, 0.35)';
        c.fill();
      }
    }

    c.restore();
  }

  function drawWheel() {
    // Renders the wheel at orientation 0 onto the visible canvas.
    // Live rotation during spin is applied via CSS transform (GPU-only).
    const size = wheelCacheSize;
    if (!size) return;
    const cx = size / 2;
    const cy = size / 2;

    ctx.clearRect(0, 0, size, size);

    if (items.length === 0) {
      drawEmptyWheel(cx, cy, size / 2 - 6);
      return;
    }

    ctx.drawImage(wheelCache, 0, 0, size, size);
  }

  function applyRotation(r) {
    canvas.style.transform = `translateZ(0) rotate(${r}rad)`;
  }

  function refreshWheel() {
    rebuildWheelCache();
    drawWheel();
    applyRotation(rotation);
  }

  function drawLabel(c, text, midAngle, radius, segAngle) {
    c.save();
    c.rotate(midAngle);
    c.textAlign = 'right';
    c.textBaseline = 'middle';

    const arcLen = segAngle * radius;
    const maxFont = Math.min(22, Math.max(11, arcLen / 3.2));
    const padding = 18;
    const maxWidth = radius - padding - radius * 0.18;

    let fontSize = maxFont;
    c.font = `600 ${fontSize}px 'Inter', sans-serif`;
    let display = text;
    let measured = c.measureText(display).width;

    while (measured > maxWidth && fontSize > 9) {
      fontSize -= 1;
      c.font = `600 ${fontSize}px 'Inter', sans-serif`;
      measured = c.measureText(display).width;
    }

    if (measured > maxWidth) {
      while (display.length > 1 && c.measureText(display + '…').width > maxWidth) {
        display = display.slice(0, -1);
      }
      display = display + '…';
    }

    c.fillStyle = 'rgba(20, 20, 30, 0.95)';
    c.shadowColor = 'rgba(255, 255, 255, 0.25)';
    c.shadowBlur = 2;
    c.shadowOffsetY = 0.5;
    c.fillText(display, radius - padding, 0);
    c.restore();
  }

  function drawEmptyWheel(cx, cy, radius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, 'rgba(40, 40, 60, 0.5)');
    grad.addColorStop(1, 'rgba(15, 15, 28, 0.8)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(168, 168, 184, 0.6)';
    ctx.font = `500 16px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Lägg till alternativ →', 0, 0);
    ctx.restore();
  }

  // Color helpers (operate on HSL strings)
  function adjustHsl(hsl, dl) {
    const m = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)%,\s*(\d+(?:\.\d+)?)%\)/);
    if (!m) return hsl;
    const h = parseFloat(m[1]);
    const s = parseFloat(m[2]);
    const l = Math.max(0, Math.min(100, parseFloat(m[3]) + dl));
    return `hsl(${h}, ${s}%, ${l}%)`;
  }
  function lighten(c, n) { return adjustHsl(c, n); }
  function darken(c, n) { return adjustHsl(c, -n); }

  // ====== ITEM LIST UI ======
  function renderList() {
    itemsList.innerHTML = '';
    countEl.textContent = items.length;

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Inga alternativ ännu';
      itemsList.appendChild(empty);
      return;
    }

    items.forEach((item, idx) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.style.animationDelay = `${idx * 25}ms`;

      const dot = document.createElement('span');
      dot.className = 'item-color';
      dot.style.background = colorFor(idx, items.length);
      dot.style.color = colorFor(idx, items.length);

      const text = document.createElement('span');
      text.className = 'item-text';
      text.textContent = item;

      const remove = document.createElement('button');
      remove.className = 'item-remove';
      remove.setAttribute('aria-label', 'Ta bort');
      remove.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
      remove.addEventListener('click', () => removeItem(idx));

      li.appendChild(dot);
      li.appendChild(text);
      li.appendChild(remove);
      itemsList.appendChild(li);
    });
  }

  function addItem(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    items.push(trimmed);
    saveItems();
    renderList();
    refreshWheel();
  }

  function removeItem(idx) {
    const li = itemsList.children[idx];
    if (li && li.classList) {
      li.classList.add('removing');
      setTimeout(() => {
        items.splice(idx, 1);
        saveItems();
        renderList();
        refreshWheel();
      }, 220);
    } else {
      items.splice(idx, 1);
      saveItems();
      renderList();
      refreshWheel();
    }
  }

  function clearItems() {
    if (items.length === 0) return;
    items = [];
    saveItems();
    renderList();
    refreshWheel();
  }

  function shuffleItems() {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    saveItems();
    renderList();
    refreshWheel();
  }

  // ====== SPIN ======
  function easeOutQuart(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function spin() {
    if (isSpinning || items.length < 2) return;
    isSpinning = true;
    spinBtn.disabled = true;
    spinBtn.classList.add('spinning');
    hideResult();
    lastTickSegment = -1;

    const n = items.length;
    const segAngle = (Math.PI * 2) / n;
    const startRotation = rotation;
    const turns = 5 + Math.random() * 3;
    const extra = Math.random() * Math.PI * 2;
    const totalDelta = turns * Math.PI * 2 + extra;
    const endRotation = startRotation + totalDelta;
    const duration = 5200 + Math.random() * 800;
    const t0 = performance.now();

    function frame(now) {
      const t = now - t0 >= duration ? 1 : (now - t0) / duration;
      const eased = easeOutQuart(t);
      rotation = startRotation + totalDelta * eased;
      applyRotation(rotation);

      const currentSeg = ((Math.floor(-rotation / segAngle) % n) + n) % n;
      if (currentSeg !== lastTickSegment && lastTickSegment !== -1) {
        triggerTick();
      }
      lastTickSegment = currentSeg;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        rotation = endRotation;
        applyRotation(rotation);
        finishSpin();
      }
    }

    requestAnimationFrame(frame);
  }

  function currentSegmentIndex() {
    const n = items.length;
    if (n === 0) return -1;
    const segAngle = (Math.PI * 2) / n;
    // Pointer is at top (-π/2 in canvas coords). Segments are drawn starting at -π/2.
    // After rotating by `rotation`, segment i occupies [i*segAngle - π/2 + rotation, ...] mod 2π.
    // The segment under the pointer satisfies pointerAngle in that range, where pointerAngle = -π/2.
    // Solve for i: i = floor(((-π/2) - (-π/2 + rotation)) / segAngle) mod n
    //            = floor((-rotation) / segAngle) mod n
    let raw = -rotation / segAngle;
    let idx = Math.floor(((raw % n) + n) % n);
    return idx;
  }

  function finishSpin() {
    const winnerIdx = currentSegmentIndex();
    const winner = items[winnerIdx];
    isSpinning = false;
    spinBtn.disabled = false;
    spinBtn.classList.remove('spinning');

    // Normalize rotation to keep numbers small, then re-apply so the canvas
    // visually matches the new (equivalent) angle.
    rotation = rotation % (Math.PI * 2);
    applyRotation(rotation);

    if (winner != null) {
      showResult(winner, winnerIdx);
      launchConfetti();
    }
  }

  function triggerTick() {
    pointer.classList.remove('tick');
    // Force reflow to restart animation
    void pointer.offsetWidth;
    pointer.classList.add('tick');
  }

  // ====== RESULT MODAL ======
  let lastWinnerIdx = -1;
  function showResult(text, idx) {
    lastWinnerIdx = idx;
    resultText.textContent = text;
    resultModal.classList.add('show');
    resultModal.setAttribute('aria-hidden', 'false');
  }
  function hideResult() {
    resultModal.classList.remove('show');
    resultModal.setAttribute('aria-hidden', 'true');
  }

  // ====== CONFETTI ======
  function resizeConfetti() {
    const dpr = window.devicePixelRatio || 1;
    confettiCanvas.width = window.innerWidth * dpr;
    confettiCanvas.height = window.innerHeight * dpr;
    confettiCanvas.style.width = window.innerWidth + 'px';
    confettiCanvas.style.height = window.innerHeight + 'px';
    confettiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** @type {Array<{x:number,y:number,vx:number,vy:number,size:number,color:string,rot:number,vrot:number,life:number,shape:number}>} */
  let particles = [];
  let confettiAnimating = false;

  function launchConfetti() {
    const colors = ['#b794ff', '#ff71b8', '#6dd5ff', '#ffd166', '#06d6a0', '#f78c6b'];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const count = 180;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 6 + Math.random() * 10;
      particles.push({
        x: cx + (Math.random() - 0.5) * 80,
        y: cy + (Math.random() - 0.5) * 80,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.4,
        life: 1,
        shape: Math.floor(Math.random() * 3),
      });
    }
    if (!confettiAnimating) {
      confettiAnimating = true;
      requestAnimationFrame(stepConfetti);
    }
  }

  function stepConfetti() {
    confettiCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    const gravity = 0.28;
    const drag = 0.992;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= drag;
      p.vy = p.vy * drag + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life -= 0.008;

      if (p.life <= 0 || p.y > window.innerHeight + 40) {
        particles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate(p.rot);
      confettiCtx.globalAlpha = Math.max(0, Math.min(1, p.life));
      confettiCtx.fillStyle = p.color;

      if (p.shape === 0) {
        // Rectangle
        confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      } else if (p.shape === 1) {
        // Circle
        confettiCtx.beginPath();
        confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        confettiCtx.fill();
      } else {
        // Ribbon (thin rect)
        confettiCtx.fillRect(-p.size / 2, -p.size / 8, p.size, p.size / 4);
      }
      confettiCtx.restore();
    }

    if (particles.length > 0) {
      requestAnimationFrame(stepConfetti);
    } else {
      confettiAnimating = false;
    }
  }

  // ====== EVENTS ======
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addItem(itemInput.value);
    itemInput.value = '';
    itemInput.focus();
  });

  spinBtn.addEventListener('click', spin);

  clearBtn.addEventListener('click', () => {
    if (confirm('Rensa alla alternativ?')) clearItems();
  });

  shuffleBtn.addEventListener('click', shuffleItems);

  closeResult.addEventListener('click', hideResult);
  removeWinnerBtn.addEventListener('click', () => {
    if (lastWinnerIdx >= 0 && lastWinnerIdx < items.length) {
      items.splice(lastWinnerIdx, 1);
      saveItems();
      renderList();
      refreshWheel();
    }
    hideResult();
  });

  resultModal.addEventListener('click', (e) => {
    if (e.target.classList.contains('result-backdrop')) hideResult();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideResult();
    if (e.key === ' ' && document.activeElement !== itemInput && !isSpinning) {
      e.preventDefault();
      spin();
    }
  });

  window.addEventListener('resize', () => {
    setupCanvas();
    resizeConfetti();
  });

  // ====== INIT ======
  setupCanvas();
  resizeConfetti();
  renderList();
})();
