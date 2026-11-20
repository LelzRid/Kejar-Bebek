(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  // HUD elements
  const hudLevel = document.getElementById('hud-level');
  const hudDucks = document.getElementById('hud-ducks');
  const hudTimer = document.getElementById('hud-timer');
  const timerPill = document.getElementById('timer-pill');
  const hudScore = document.getElementById('hud-score');
  const dashBarFill = document.getElementById('dash-bar-fill');
  const slowHud = document.getElementById('slow-hud');
  const slowTimerEl = document.getElementById('slow-timer');
  const upgradesHud = document.getElementById('upgrades-hud');
  const cardChoicesEl = document.getElementById('card-choices');
  const btnSound = document.getElementById('btn-sound');
  const btnPause = document.getElementById('btn-pause');

  // Overlays
  const overlayStart = document.getElementById('overlay-start');
  const overlayPause = document.getElementById('overlay-pause');
  const overlayWin = document.getElementById('overlay-win');
  const overlayGameOver = document.getElementById('overlay-gameover');

  const startHighscore = document.getElementById('start-highscore');
  const winTitle = document.getElementById('win-title');
  const winTime = document.getElementById('win-time');
  const winBonus = document.getElementById('win-bonus');
  const winScore = document.getElementById('win-score');
  const goCaught = document.getElementById('go-caught');
  const goScore = document.getElementById('go-score');
  const goHighscore = document.getElementById('go-highscore');

  // World constants
  const W = canvas.width;
  const H = canvas.height;
  const FENCE = 38;

  // Pond (decorative + ducks swim slightly faster, splashes!)
  const pond = { x: W * 0.72, y: H * 0.56, rx: 125, ry: 82 };

  // Obstacles (hay bales / rocks)
  const obstacles = [
    { x: 250, y: 195, r: 28, type: 'hay' },
    { x: 310, y: 440, r: 25, type: 'rock' },
    { x: 640, y: 165, r: 26, type: 'hay' },
  ];

  // Decorative flowers & grass tufts
  const flowers = Array.from({ length: 28 }, (_, i) => ({
    x: FENCE + 30 + ((i * 137) % (W - FENCE * 2 - 60)),
    y: FENCE + 30 + ((i * 211) % (H - FENCE * 2 - 60)),
    color: ['#fff3bf', '#ffc9c9', '#d0ebff', '#ffd8a8'][i % 4],
    size: 3 + (i % 3),
  })).filter((f) => !isInPond(f.x, f.y, 18));

  // Difficulty presets
  const DIFFICULTIES = {
    easy: { baseDucks: 7, ducksPerLevel: 2, baseTime: 40, duckSpeedMult: 0.85, label: 'Santai' },
    normal: { baseDucks: 10, ducksPerLevel: 3, baseTime: 35, duckSpeedMult: 1.0, label: 'Normal' },
    hard: { baseDucks: 13, ducksPerLevel: 4, baseTime: 32, duckSpeedMult: 1.18, label: 'Cepat' },
  };

  let difficulty = 'normal';
  let soundEnabled = true;
  let audioCtx = null;

  // Game state
  let state = 'start'; // 'start' | 'playing' | 'paused' | 'win' | 'gameover'
  let level = 1;
  let score = 0;
  let highScore = Number(localStorage.getItem('kejar_bebek_highscore') || 0);
  let timeLeft = 35;
  let totalDucks = 10;
  let caughtCount = 0;
  let combo = 0;
  let comboTimer = 0;
  let lastTickSecond = 6;
  let screenShake = 0;

  // Input
  const keys = {};

  // Entities
  const player = {
    x: 140,
    y: H / 2,
    r: 18,
    baseSpeed: 235,
    dashSpeed: 540,
    dashTime: 0,
    dashDuration: 0.19,
    dashCooldown: 0,
    dashMaxCooldown: 1.35,
    dashCaught: false,
    slowTimer: 0,
    slowDuration: 2, // 2 detik melambat kalau kena taik!
    stinkEmitTimer: 0,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
    walkCycle: 0,
  };

  let ducks = [];
  let poops = [];
  let particles = [];
  let floatingTexts = [];
  let ripples = [];
  let globalTauntCooldown = 0;

  // Ragebait taunt lines
  const TAUNTS_CHASE = [
    'Lambat amat! 😜',
    'Skill issue! 🦆',
    'Sini tangkap! 🤪',
    'Ez banget wkwk',
    'Ngejar apa jalan santai?',
    'Ga kena wlee! 😝',
    'Lari dong bang!',
    'Dikit lagi tuh~ 😏',
    'Kwek kwek payah!',
  ];
  const TAUNTS_MISS_DASH = [
    'Meleset wkwk! 😂',
    'Dash ke mana tuh?',
    'Nge-dash angin doang! 💨',
    'Kena angin doang ya? 😜',
  ];
  const TAUNTS_POOP_STEP = [
    'WKWK KENA TAIK! 💩',
    'Bau banget bang! 🤢',
    'Rasain tuh! 😂',
    'Makin lambat deh! 😜',
    'Liat jalan dong! 🤣',
    'Eww injek taik! 💩',
  ];
  const TAUNTS_SLOWED = [
    'Jalan kayak siput 🐌',
    'Pelan amat bos~ 😏',
    'Cuci kaki dulu sana! 💩',
    'Kasian kena taik wkwk',
  ];
  const TAUNTS_POOP_DROP = [
    'Nih hadiah! 💩',
    'Awas licin~ 😏',
    'Oleh-oleh nih! 💩',
  ];
  const TAUNTS_FLY = [
    'Bye-bye! ✈️',
    'Terbang dulu bos! 🪽',
    'Gabisa terbang ya? 😜',
    'Dadahh~ ☁️',
  ];
  const TAUNTS_NINJA = [
    'Kagebunshin! 🥷',
    'Hilang wkwk! 💨',
    'Cuma bayangan! 🥷',
  ];

  // Roguelite Power-Up Cards (choose 1 of 3 after each level)
  const UPGRADE_POOL = [
    {
      id: 'speed',
      icon: '👟',
      name: 'Sepatu Kilat',
      desc: 'Kecepatan lari meningkat +15%',
      maxLv: 5,
    },
    {
      id: 'dashRange',
      icon: '🚀',
      name: 'Lompatan Jauh',
      desc: 'Jarak & kecepatan Dash meningkat +26%',
      maxLv: 5,
    },
    {
      id: 'dashCd',
      icon: '⚡',
      name: 'Stamina Instan',
      desc: 'Cooldown Dash berkurang -20%',
      maxLv: 4,
    },
    {
      id: 'netSize',
      icon: '🕸️',
      name: 'Jaring Raksasa',
      desc: 'Jangkauan tangkap bebek lebih lebar +22%',
      maxLv: 5,
    },
    {
      id: 'antiPoop',
      icon: '🥾',
      name: 'Sepatu Anti-Taik',
      desc: 'Durasi lambat kena taik berkurang -40%',
      maxLv: 3,
    },
    {
      id: 'extraTime',
      icon: '⏳',
      name: 'Jam Ajaib',
      desc: 'Tambahan waktu +6 detik setiap level baru',
      maxLv: 4,
    },
    {
      id: 'magnet',
      icon: '🧲',
      name: 'Magnet Bebek',
      desc: 'Saat Dash, bebek di sekitar tertarik ke arahmu',
      maxLv: 3,
    },
    {
      id: 'pondBoots',
      icon: '🏊',
      name: 'Kaki Katak',
      desc: 'Tidak melambat di kolam, malah jadi lebih cepat!',
      maxLv: 2,
    },
  ];

  let upgrades = {};
  let currentCardChoices = [];

  function resetUpgrades() {
    upgrades = {};
    for (const u of UPGRADE_POOL) upgrades[u.id] = 0;
    renderUpgradesHud();
  }

  function renderUpgradesHud() {
    upgradesHud.innerHTML = '';
    for (const u of UPGRADE_POOL) {
      const lv = upgrades[u.id] || 0;
      if (lv > 0) {
        const chip = document.createElement('div');
        chip.className = 'upgrade-chip';
        chip.title = `${u.name} (Lv.${lv})`;
        chip.textContent = `${u.icon} x${lv}`;
        upgradesHud.appendChild(chip);
      }
    }
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---- Audio (Web Audio API) ----
  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playQuack(pitch = 1) {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(520 * pitch, now + 0.045);
    osc.frequency.exponentialRampToValueAtTime(240 * pitch, now + 0.13);

    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950 * pitch, now);
    filter.Q.setValueAtTime(3, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  function playCatch(isGold, comboLevel) {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const base = isGold ? 660 : 440 + Math.min(comboLevel, 6) * 55;
    [base, base * 1.25, isGold ? base * 1.5 : base * 1.33].forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.05;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.14, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  function playDash() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.12);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  function playTick() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function playFanfare(win) {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const notes = win ? [523, 659, 784, 1046] : [392, 349, 311, 261];
    notes.forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.1;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  function playPoopDrop() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  function playStepPoop() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.34);

    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }

  function playMockLaugh() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    [0, 0.09, 0.18].forEach((offset, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sawtooth';
      const t = now + offset;
      const base = 480 + (idx % 2) * 70;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.28, t + 0.035);
      osc.frequency.exponentialRampToValueAtTime(base * 0.72, t + 0.08);

      const filter = ac.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1250, t);
      filter.Q.setValueAtTime(3.2, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.085, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.09);
    });
  }

  function playTakeoff() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.24);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  function playSmokePoof() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  function playCardPick() {
    const ac = ensureAudio();
    if (!ac) return;
    const now = ac.currentTime;
    [587, 784, 1175].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = 'sine';
      const t = now + i * 0.06;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  }

  // ---- Helpers ----
  function isInPond(x, y, pad = 0) {
    const dx = (x - pond.x) / (pond.rx + pad);
    const dy = (y - pond.y) / (pond.ry + pad);
    return dx * dx + dy * dy <= 1;
  }

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function resolveObstacles(entity) {
    // Fence boundaries
    entity.x = clamp(entity.x, FENCE + entity.r, W - FENCE - entity.r);
    entity.y = clamp(entity.y, FENCE + entity.r, H - FENCE - entity.r);

    // Circular obstacles
    for (const obs of obstacles) {
      const dx = entity.x - obs.x;
      const dy = entity.y - obs.y;
      const d = Math.hypot(dx, dy);
      const minD = entity.r + obs.r;
      if (d < minD && d > 0.0001) {
        const push = minD - d;
        entity.x += (dx / d) * push;
        entity.y += (dy / d) * push;
      }
    }
  }

  function spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 60 + Math.random() * 140;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.75,
        size: 3 + Math.random() * 4,
        color,
      });
    }
  }

  function spawnFloatingText(x, y, text, color = '#ffe066') {
    floatingTexts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  function spawnRipple(x, y) {
    ripples.push({ x, y, r: 6, maxR: 26, life: 0.55, maxLife: 0.55 });
  }

  // ---- Level Setup ----
  function getEffectiveDashMaxCooldown() {
    return player.dashMaxCooldown * Math.pow(0.8, upgrades.dashCd || 0);
  }

  function setupLevel(lvl) {
    const preset = DIFFICULTIES[difficulty];
    level = lvl;
    totalDucks = preset.baseDucks + (lvl - 1) * preset.ducksPerLevel;
    timeLeft = Math.max(24, preset.baseTime + (lvl - 1) * 3) + (upgrades.extraTime || 0) * 6;
    caughtCount = 0;
    combo = 0;
    comboTimer = 0;
    lastTickSecond = 6;

    // Reset player
    player.x = 120;
    player.y = H / 2;
    player.vx = 0;
    player.vy = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.dashCaught = false;
    player.slowTimer = 0;
    player.stinkEmitTimer = 0;
    player.facingX = 1;
    player.facingY = 0;

    // Spawn ducks with diverse variants!
    ducks = [];
    poops = [];
    particles = [];
    floatingTexts = [];
    ripples = [];
    globalTauntCooldown = 0.8;

    const goldCount = Math.min(2, 1 + Math.floor((lvl - 1) / 2));
    const flyerCount = Math.max(2, Math.floor(totalDucks * 0.2));
    const ninjaCount = Math.max(1, Math.floor(totalDucks * 0.14));
    const pooperCount = Math.max(1, Math.floor(totalDucks * 0.14));
    const fastCount = Math.floor(totalDucks * 0.22);

    const variantList = [];
    for (let i = 0; i < goldCount; i++) variantList.push('gold');
    for (let i = 0; i < flyerCount; i++) variantList.push('flyer');
    for (let i = 0; i < ninjaCount; i++) variantList.push('ninja');
    for (let i = 0; i < pooperCount; i++) variantList.push('pooper');
    for (let i = 0; i < fastCount; i++) variantList.push('fast');
    while (variantList.length < totalDucks) variantList.push('normal');

    for (let i = 0; i < totalDucks; i++) {
      const type = variantList[i];

      let x = 0;
      let y = 0;
      let attempts = 0;
      do {
        x = FENCE + 50 + Math.random() * (W - FENCE * 2 - 100);
        y = FENCE + 50 + Math.random() * (H - FENCE * 2 - 100);
        attempts++;
      } while (
        attempts < 40 &&
        (dist(x, y, player.x, player.y) < 200 ||
          obstacles.some((o) => dist(x, y, o.x, o.y) < o.r + 30))
      );

      const speedMult = preset.duckSpeedMult * (1 + (lvl - 1) * 0.04);
      const baseSpeed =
        type === 'gold'
          ? 215 * speedMult
          : type === 'fast'
            ? 188 * speedMult
            : type === 'ninja'
              ? 172 * speedMult
              : type === 'flyer'
                ? 158 * speedMult
                : type === 'pooper'
                  ? 142 * speedMult
                  : 148 * speedMult;

      ducks.push({
        x,
        y,
        r: type === 'gold' ? 14 : type === 'pooper' ? 16 : 15,
        vx: 0,
        vy: 0,
        type,
        baseSpeed,
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTimer: 0.5 + Math.random() * 1.5,
        panicked: false,
        panicTimer: 0,
        quackBubble: 0,
        tauntText: '',
        tauntTimer: 0,
        tauntCooldown: 1.5 + Math.random() * 2.5,
        smugTimer: 0,
        poopCooldown: type === 'pooper' ? 1.5 + Math.random() * 2.2 : 2.8 + Math.random() * 5.2,
        // Flying duck ability (10s cooldown!)
        flyCooldown: type === 'flyer' ? 1.5 + Math.random() * 2.0 : 0,
        flyTimer: 0,
        flyDuration: 1.15,
        flyHeight: 0,
        flyDirX: 0,
        flyDirY: 0,
        // Ninja duck smoke-dash ability (8s cooldown)
        smokeCooldown: type === 'ninja' ? 1.5 + Math.random() * 2.0 : 0,
        waddle: Math.random() * Math.PI * 2,
        rippleTimer: 0,
        facingX: Math.random() < 0.5 ? -1 : 1,
      });
    }

    updateHUD();
  }

  function triggerDuckTaunt(duck, text, laugh = false) {
    duck.tauntText = text;
    duck.tauntTimer = 2.0;
    duck.tauntCooldown = 3.2 + Math.random() * 2.0;
    duck.smugTimer = 2.0;
    duck.quackBubble = 0;
    if (laugh) playMockLaugh();
  }

  function updateHUD() {
    hudLevel.textContent = level;
    hudDucks.textContent = `${caughtCount} / ${totalDucks}`;
    hudTimer.textContent = `${Math.max(0, timeLeft).toFixed(1)}d`;
    hudScore.textContent = score;
    timerPill.classList.toggle('urgent', state === 'playing' && timeLeft <= 7);

    const dashMaxCd = getEffectiveDashMaxCooldown();
    const dashReady = 1 - player.dashCooldown / dashMaxCd;
    dashBarFill.style.width = `${clamp(dashReady, 0, 1) * 100}%`;

    const isSlowed = player.slowTimer > 0 && state === 'playing';
    slowHud.classList.toggle('active', isSlowed);
    if (isSlowed) {
      slowTimerEl.textContent = `${player.slowTimer.toFixed(1)}d`;
    }
  }

  function showOverlay(target) {
    [overlayStart, overlayPause, overlayWin, overlayGameOver].forEach((el) =>
      el.classList.toggle('active', el === target)
    );
  }

  function saveHighScore() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('kejar_bebek_highscore', String(highScore));
    }
    startHighscore.textContent = highScore;
  }

  function startNewGame() {
    ensureAudio();
    score = 0;
    resetUpgrades();
    setupLevel(1);
    state = 'playing';
    showOverlay(null);
    updateHUD();
  }

  function nextLevel() {
    ensureAudio();
    setupLevel(level + 1);
    state = 'playing';
    showOverlay(null);
    updateHUD();
  }

  function showUpgradeCards() {
    // Pick 3 distinct random upgrades that haven't hit maxLv yet
    const available = UPGRADE_POOL.filter((u) => (upgrades[u.id] || 0) < u.maxLv);
    const pool = available.length >= 3 ? [...available] : [...UPGRADE_POOL];
    // Fisher-Yates shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    currentCardChoices = pool.slice(0, 3);

    cardChoicesEl.innerHTML = '';
    currentCardChoices.forEach((u, idx) => {
      const curLv = upgrades[u.id] || 0;
      const btn = document.createElement('button');
      btn.className = 'power-card';
      btn.innerHTML = `
        <div class="power-icon">${u.icon}</div>
        <div class="power-name">${u.name}</div>
        <div class="power-desc">${u.desc}</div>
        <div class="power-lv">Lv. ${curLv} → Lv. ${curLv + 1} (Tekan ${idx + 1})</div>
      `;
      btn.addEventListener('click', () => pickUpgradeCard(idx));
      cardChoicesEl.appendChild(btn);
    });
  }

  function pickUpgradeCard(index) {
    if (state !== 'win') return;
    const chosen = currentCardChoices[index];
    if (!chosen) return;
    upgrades[chosen.id] = (upgrades[chosen.id] || 0) + 1;
    renderUpgradesHud();
    playCardPick();
    nextLevel();
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      showOverlay(overlayPause);
    } else if (state === 'paused') {
      state = 'playing';
      showOverlay(null);
    }
  }

  function triggerDash() {
    if (state !== 'playing') return;
    if (player.dashCooldown > 0) return;
    const dashDurMult = 1 + (upgrades.dashRange || 0) * 0.26;
    player.dashTime = player.dashDuration * dashDurMult;
    player.dashCooldown = getEffectiveDashMaxCooldown();
    player.dashCaught = false;
    playDash();
    spawnParticles(player.x, player.y, player.slowTimer > 0 ? '#94d82d' : '#ffe066', 8);
  }

  // ---- Update Loop ----
  function update(dt) {
    if (state !== 'playing') return;

    // Timer
    timeLeft -= dt;
    if (timeLeft <= 5 && Math.ceil(timeLeft) < lastTickSecond && timeLeft > 0) {
      lastTickSecond = Math.ceil(timeLeft);
      playTick();
    }

    if (timeLeft <= 0) {
      timeLeft = 0;
      state = 'gameover';
      saveHighScore();
      goCaught.textContent = `${caughtCount} / ${totalDucks}`;
      goScore.textContent = score;
      goHighscore.textContent = highScore;
      showOverlay(overlayGameOver);
      playFanfare(false);
      updateHUD();
      return;
    }

    // Combo decay
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }

    if (screenShake > 0) {
      screenShake = Math.max(0, screenShake - dt * 25);
    }

    if (globalTauntCooldown > 0) {
      globalTauntCooldown = Math.max(0, globalTauntCooldown - dt);
    }

    // Slow debuff timer (1 menit dari taik bebek)
    if (player.slowTimer > 0) {
      player.slowTimer = Math.max(0, player.slowTimer - dt);
      player.stinkEmitTimer -= dt;
      if (player.stinkEmitTimer <= 0) {
        player.stinkEmitTimer = 0.22;
        particles.push({
          x: player.x + (Math.random() - 0.5) * 18,
          y: player.y + 8,
          vx: (Math.random() - 0.5) * 20,
          vy: -25 - Math.random() * 25,
          life: 0.65,
          maxLife: 0.65,
          size: 4 + Math.random() * 3,
          color: Math.random() < 0.5 ? 'rgba(148, 216, 45, 0.75)' : 'rgba(130, 92, 42, 0.7)',
        });
      }
    }

    // Player movement (WASD + Arrows)
    let ix = 0;
    let iy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;

    if (ix !== 0 || iy !== 0) {
      const len = Math.hypot(ix, iy);
      ix /= len;
      iy /= len;
      player.facingX = ix;
      player.facingY = iy;
      const walkRate = player.dashTime > 0 ? 22 : player.slowTimer > 0 ? 7 : 12;
      player.walkCycle += dt * walkRate;
    }

    if (player.dashCooldown > 0) {
      player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    }

    let currentSpeed = player.baseSpeed * (1 + (upgrades.speed || 0) * 0.15);
    if (player.slowTimer > 0) {
      currentSpeed *= 0.52; // melambat parah kena taik!
    }
    if (isInPond(player.x, player.y)) {
      const pondLv = upgrades.pondBoots || 0;
      currentSpeed *= pondLv > 0 ? 1 + pondLv * 0.15 : 0.78;
      if ((ix !== 0 || iy !== 0) && Math.random() < dt * 7) {
        spawnRipple(player.x, player.y + 8);
      }
    }

    if (player.dashTime > 0) {
      player.dashTime -= dt;
      const dashSpdBoost = 1 + (upgrades.dashRange || 0) * 0.12;
      currentSpeed =
        (player.slowTimer > 0 ? player.dashSpeed * 0.68 : player.dashSpeed) * dashSpdBoost;
      const dx = ix !== 0 || iy !== 0 ? ix : player.facingX;
      const dy = ix !== 0 || iy !== 0 ? iy : player.facingY;
      player.vx = dx * currentSpeed;
      player.vy = dy * currentSpeed;
      if (Math.random() < 0.6) {
        particles.push({
          x: player.x - dx * 10,
          y: player.y - dy * 10,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.22,
          maxLife: 0.22,
          size: 5,
          color: player.slowTimer > 0 ? 'rgba(148, 216, 45, 0.75)' : 'rgba(255, 224, 102, 0.7)',
        });
      }

      // If dash just finished without catching any duck, nearby duck mocks player!
      if (player.dashTime <= 0 && !player.dashCaught && globalTauntCooldown <= 0) {
        const mockDuck = ducks.find((dk) => dist(dk.x, dk.y, player.x, player.y) < 190);
        if (mockDuck) {
          triggerDuckTaunt(mockDuck, pickRandom(TAUNTS_MISS_DASH), true);
          globalTauntCooldown = 1.6;
        }
      }
    } else {
      player.vx = ix * currentSpeed;
      player.vy = iy * currentSpeed;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    resolveObstacles(player);

    // Update poops & check if player steps on one
    for (let i = poops.length - 1; i >= 0; i--) {
      const poop = poops[i];
      poop.life -= dt;
      poop.wobble += dt * 5;
      if (poop.life <= 0) {
        poops.splice(i, 1);
        continue;
      }

      if (dist(player.x, player.y, poop.x, poop.y) < player.r + poop.r - 4) {
        poops.splice(i, 1);
        const resistMult = Math.pow(0.6, upgrades.antiPoop || 0);
        player.slowTimer = Math.max(0.3, player.slowDuration * resistMult);
        screenShake = 8;
        playStepPoop();
        spawnParticles(player.x, player.y, '#795028', 14);
        spawnParticles(player.x, player.y, '#94d82d', 10);
        spawnFloatingText(player.x, player.y - 20, '💩 KENA TAIK! LAMBAT!', '#c0eb75');

        // Nearby ducks immediately mock the player!
        const nearby = ducks
          .map((dk) => ({ dk, d: dist(dk.x, dk.y, player.x, player.y) }))
          .sort((a, b) => a.d - b.d)
          .slice(0, 2);
        nearby.forEach((item, idx) => {
          triggerDuckTaunt(item.dk, pickRandom(TAUNTS_POOP_STEP), idx === 0);
        });
        globalTauntCooldown = 2.0;
      }
    }

    // Update ducks
    const netBonus = (upgrades.netSize || 0) * 6;
    const catchRadius = player.r + (player.dashTime > 0 ? 20 : 14) + netBonus;

    for (let i = ducks.length - 1; i >= 0; i--) {
      const d = ducks[i];
      const dxToPlayer = d.x - player.x;
      const dyToPlayer = d.y - player.y;
      const distPlayer = Math.hypot(dxToPlayer, dyToPlayer);

      // Cooldown ticks for special duck variants
      if (d.flyCooldown > 0) d.flyCooldown = Math.max(0, d.flyCooldown - dt);
      if (d.smokeCooldown > 0) d.smokeCooldown = Math.max(0, d.smokeCooldown - dt);

      // ---- Flying Duck (Bebek Terbang) Airborne State ----
      if (d.type === 'flyer' && d.flyTimer > 0) {
        d.flyTimer = Math.max(0, d.flyTimer - dt);
        const progress = 1 - d.flyTimer / d.flyDuration;
        // Smooth parabolic altitude arc (0 -> 56px -> 0)
        d.flyHeight = Math.sin(progress * Math.PI) * 56;
        d.x += d.flyDirX * 365 * dt;
        d.y += d.flyDirY * 365 * dt;
        // Keep inside fence while flying
        if (d.x < FENCE + d.r) {
          d.x = FENCE + d.r;
          d.flyDirX = Math.abs(d.flyDirX);
        } else if (d.x > W - FENCE - d.r) {
          d.x = W - FENCE - d.r;
          d.flyDirX = -Math.abs(d.flyDirX);
        }
        if (d.y < FENCE + d.r) {
          d.y = FENCE + d.r;
          d.flyDirY = Math.abs(d.flyDirY);
        } else if (d.y > H - FENCE - d.r) {
          d.y = H - FENCE - d.r;
          d.flyDirY = -Math.abs(d.flyDirY);
        }
        d.facingX = d.flyDirX >= 0 ? 1 : -1;
        d.waddle += dt * 32;
        if (d.tauntTimer > 0) d.tauntTimer = Math.max(0, d.tauntTimer - dt);
        if (d.smugTimer > 0) d.smugTimer = Math.max(0, d.smugTimer - dt);
        if (Math.random() < dt * 16) {
          particles.push({
            x: d.x,
            y: d.y - d.flyHeight + 6,
            vx: (Math.random() - 0.5) * 35,
            vy: 15 + Math.random() * 25,
            life: 0.35,
            maxLife: 0.35,
            size: 3.5,
            color: '#a5d8ff',
          });
        }
        if (d.flyTimer <= 0) {
          d.flyHeight = 0;
          resolveObstacles(d);
        }
        continue; // Cannot be caught while flying in the air!
      }

      // Trigger Flying Duck takeoff when chased closely (10s cooldown!)
      if (d.type === 'flyer' && d.flyCooldown <= 0 && distPlayer < 135) {
        d.flyTimer = d.flyDuration;
        d.flyCooldown = 10; // 10 detik cooldown terbang!
        const nx = dxToPlayer / (distPlayer || 1);
        const ny = dyToPlayer / (distPlayer || 1);
        // Bias slightly toward center if near edge so it flies far across the yard
        const cx = (W / 2 - d.x) / (W / 2);
        const cy = (H / 2 - d.y) / (H / 2);
        let fx = nx * 0.8 + cx * 0.45 + (Math.random() - 0.5) * 0.3;
        let fy = ny * 0.8 + cy * 0.45 + (Math.random() - 0.5) * 0.3;
        const fl = Math.hypot(fx, fy) || 1;
        d.flyDirX = fx / fl;
        d.flyDirY = fy / fl;
        playTakeoff();
        spawnParticles(d.x, d.y, '#74c0fc', 12);
        triggerDuckTaunt(d, pickRandom(TAUNTS_FLY), false);
        continue;
      }

      // Trigger Ninja Duck smoke-bomb teleport when nearly caught (8s cooldown!)
      if (d.type === 'ninja' && d.smokeCooldown <= 0 && distPlayer < 95) {
        d.smokeCooldown = 8;
        spawnParticles(d.x, d.y, '#ced4da', 16);
        playSmokePoof();
        // Teleport ~140px away from player inside arena
        const baseAngle = Math.atan2(dyToPlayer, dxToPlayer) + (Math.random() - 0.5) * 1.4;
        const tx = clamp(d.x + Math.cos(baseAngle) * 145, FENCE + 30, W - FENCE - 30);
        const ty = clamp(d.y + Math.sin(baseAngle) * 145, FENCE + 30, H - FENCE - 30);
        d.x = tx;
        d.y = ty;
        resolveObstacles(d);
        spawnParticles(d.x, d.y, '#adb5bd', 12);
        triggerDuckTaunt(d, pickRandom(TAUNTS_NINJA), true);
        continue;
      }

      // Magnet upgrade: pull nearby grounded ducks slightly during Dash
      const magnetLv = upgrades.magnet || 0;
      if (magnetLv > 0 && player.dashTime > 0 && distPlayer < 140 + magnetLv * 35 && distPlayer > 10) {
        const pull = (120 + magnetLv * 65) * dt;
        d.x -= (dxToPlayer / distPlayer) * pull;
        d.y -= (dyToPlayer / distPlayer) * pull;
      }

      // Catch check!
      if (distPlayer <= catchRadius + d.r * 0.45) {
        if (player.dashTime > 0) player.dashCaught = true;
        ducks.splice(i, 1);
        caughtCount++;
        combo++;
        comboTimer = 2.4;

        const basePts =
          d.type === 'gold'
            ? 300
            : d.type === 'ninja'
              ? 250
              : d.type === 'flyer'
                ? 220
                : d.type === 'pooper'
                  ? 200
                  : d.type === 'fast'
                    ? 150
                    : 100;
        const mult = Math.min(4, 1 + Math.floor((combo - 1) / 2));
        const pts = basePts * mult;
        score += pts;

        if (d.type === 'gold') {
          timeLeft += 5;
          spawnFloatingText(d.x, d.y - 18, `+${pts} & +5d!`, '#ffd43b');
          spawnParticles(d.x, d.y, '#ffd43b', 20);
        } else {
          const comboTxt = mult > 1 ? ` x${mult}` : '';
          spawnFloatingText(d.x, d.y - 14, `+${pts}${comboTxt}`, '#fff3bf');
          const pColor =
            d.type === 'flyer'
              ? '#74c0fc'
              : d.type === 'ninja'
                ? '#495057'
                : d.type === 'pooper'
                  ? '#b07d4f'
                  : d.type === 'fast'
                    ? '#f8f9fa'
                    : '#ffe066';
          spawnParticles(d.x, d.y, pColor, 14);
        }

        screenShake = 5;
        playCatch(d.type === 'gold', combo);

        // Check level win -> Show 3 Power-Up Cards!
        if (ducks.length === 0) {
          state = 'win';
          const timeBonus = Math.round(timeLeft * 50);
          score += timeBonus;
          saveHighScore();
          winTitle.textContent = `Level ${level} Selesai!`;
          winTime.textContent = `${timeLeft.toFixed(1)}d`;
          winBonus.textContent = `+${timeBonus}`;
          winScore.textContent = score;
          showUpgradeCards();
          showOverlay(overlayWin);
          playFanfare(true);
          updateHUD();
          return;
        }
        continue;
      }

      // Flee & Steering AI
      const scareRadius = d.type === 'gold' ? 205 : 165;
      let steerX = 0;
      let steerY = 0;

      if (distPlayer < scareRadius) {
        if (!d.panicked) {
          d.panicked = true;
          d.quackBubble = 0.65;
          if (Math.random() < 0.65) {
            playQuack(d.type === 'gold' ? 1.35 : d.type === 'fast' ? 1.15 : 0.95);
          }
        }
        d.panicTimer = 0.9;
      } else if (d.panicTimer > 0) {
        d.panicTimer -= dt;
        if (d.panicTimer <= 0) d.panicked = false;
      }

      if (d.quackBubble > 0) d.quackBubble -= dt;
      if (d.tauntTimer > 0) d.tauntTimer = Math.max(0, d.tauntTimer - dt);
      if (d.tauntCooldown > 0) d.tauntCooldown = Math.max(0, d.tauntCooldown - dt);
      if (d.smugTimer > 0) d.smugTimer = Math.max(0, d.smugTimer - dt);

      // Ragebait taunting when being chased or when player is slowed!
      if (
        d.tauntCooldown <= 0 &&
        globalTauntCooldown <= 0 &&
        distPlayer < (player.slowTimer > 0 ? 270 : 210)
      ) {
        const line =
          player.slowTimer > 0 && Math.random() < 0.6
            ? pickRandom(TAUNTS_SLOWED)
            : pickRandom(TAUNTS_CHASE);
        triggerDuckTaunt(d, line, Math.random() < 0.55);
        globalTauntCooldown = 1.8;
      }

      // Poop dropping! Faster when panicked/running away, and 2.2x faster for Bebek Usil ('pooper')
      const poopRate = (d.panicked ? 1.8 : 0.75) * (d.type === 'pooper' ? 2.2 : 1);
      d.poopCooldown -= dt * poopRate;
      if (d.poopCooldown <= 0) {
        d.poopCooldown = d.type === 'pooper' ? 2.2 + Math.random() * 2.2 : 4.2 + Math.random() * 5.0;
        const canDropHere =
          poops.length < 18 &&
          !isInPond(d.x, d.y, -10) &&
          distPlayer > 48 &&
          !poops.some((p) => dist(p.x, p.y, d.x, d.y) < 34);
        if (canDropHere) {
          poops.push({
            x: d.x - d.facingX * 10,
            y: d.y + 6,
            r: 12,
            life: 18,
            maxLife: 18,
            wobble: Math.random() * Math.PI * 2,
          });
          playPoopDrop();
          if (d.panicked && globalTauntCooldown <= 0 && Math.random() < 0.45) {
            triggerDuckTaunt(d, pickRandom(TAUNTS_POOP_DROP), false);
            globalTauntCooldown = 1.6;
          }
        }
      }

      if (d.panicked) {
        // Flee away from player
        const nx = dxToPlayer / (distPlayer || 1);
        const ny = dyToPlayer / (distPlayer || 1);
        steerX += nx * 2.2;
        steerY += ny * 2.2;

        // Avoid getting trapped flat against walls (steer gently toward center)
        const margin = 85;
        if (d.x < FENCE + margin) steerX += ((FENCE + margin - d.x) / margin) * 1.6;
        if (d.x > W - FENCE - margin) steerX -= ((d.x - (W - FENCE - margin)) / margin) * 1.6;
        if (d.y < FENCE + margin) steerY += ((FENCE + margin - d.y) / margin) * 1.6;
        if (d.y > H - FENCE - margin) steerY -= ((d.y - (H - FENCE - margin)) / margin) * 1.6;

        // Slight organic zigzag
        steerX += Math.cos(d.waddle * 1.5) * 0.35;
        steerY += Math.sin(d.waddle * 1.5) * 0.35;
      } else {
        // Calm wandering
        d.wanderTimer -= dt;
        if (d.wanderTimer <= 0) {
          d.wanderAngle += (Math.random() - 0.5) * 2.4;
          d.wanderTimer = 0.8 + Math.random() * 1.8;
        }
        steerX += Math.cos(d.wanderAngle) * 0.55;
        steerY += Math.sin(d.wanderAngle) * 0.55;

        // Keep away from edges while wandering
        if (d.x < FENCE + 50) steerX += 0.8;
        if (d.x > W - FENCE - 50) steerX -= 0.8;
        if (d.y < FENCE + 50) steerY += 0.8;
        if (d.y > H - FENCE - 50) steerY -= 0.8;
      }

      // Separation from other ducks
      for (let j = 0; j < ducks.length; j++) {
        if (i === j) continue;
        const other = ducks[j];
        const sdx = d.x - other.x;
        const sdy = d.y - other.y;
        const sd = Math.hypot(sdx, sdy);
        if (sd < 42 && sd > 0.01) {
          const force = (42 - sd) / 42;
          steerX += (sdx / sd) * force * 1.1;
          steerY += (sdy / sd) * force * 1.1;
        }
      }

      // Obstacle avoidance
      for (const obs of obstacles) {
        const odx = d.x - obs.x;
        const ody = d.y - obs.y;
        const od = Math.hypot(odx, ody);
        if (od < obs.r + 48 && od > 0.01) {
          const force = (obs.r + 48 - od) / 48;
          steerX += (odx / od) * force * 1.8;
          steerY += (ody / od) * force * 1.8;
        }
      }

      const steerLen = Math.hypot(steerX, steerY) || 1;
      let targetSpeed = d.panicked ? d.baseSpeed : d.baseSpeed * 0.36;
      if (isInPond(d.x, d.y)) {
        targetSpeed *= 1.15; // ducks love water!
        d.rippleTimer -= dt;
        if (d.rippleTimer <= 0) {
          spawnRipple(d.x, d.y + 6);
          d.rippleTimer = d.panicked ? 0.2 : 0.55;
        }
      }

      const targetVx = (steerX / steerLen) * targetSpeed;
      const targetVy = (steerY / steerLen) * targetSpeed;

      // Smooth velocity
      const accel = d.panicked ? 10 : 4;
      d.vx += (targetVx - d.vx) * Math.min(1, accel * dt);
      d.vy += (targetVy - d.vy) * Math.min(1, accel * dt);

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      resolveObstacles(d);

      if (Math.abs(d.vx) > 5) {
        d.facingX = d.vx >= 0 ? 1 : -1;
      }
      d.waddle += dt * (d.panicked ? 18 : 7);
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // Update ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.life -= dt;
      rp.r = 6 + (1 - rp.life / rp.maxLife) * (rp.maxR - 6);
      if (rp.life <= 0) ripples.splice(i, 1);
    }

    // Update floating texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 36 * dt;
      ft.life -= dt;
      if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    updateHUD();
  }

  // ---- Render Loop ----
  function drawArena() {
    // Grass base
    ctx.fillStyle = '#55a64e';
    ctx.fillRect(0, 0, W, H);

    // Subtle grass stripes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    for (let x = 0; x < W; x += 64) {
      ctx.fillRect(x, 0, 32, H);
    }

    // Dirt patch around spawn
    ctx.fillStyle = 'rgba(181, 145, 92, 0.25)';
    ctx.beginPath();
    ctx.ellipse(125, H / 2, 72, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pond
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pond.x, pond.y, pond.rx + 9, pond.ry + 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#c2a673';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(pond.x, pond.y, pond.rx, pond.ry, 0, 0, Math.PI * 2);
    const pondGrad = ctx.createRadialGradient(
      pond.x - 25,
      pond.y - 20,
      15,
      pond.x,
      pond.y,
      pond.rx
    );
    pondGrad.addColorStop(0, '#5ec8f2');
    pondGrad.addColorStop(1, '#2b8cbe');
    ctx.fillStyle = pondGrad;
    ctx.fill();

    // Water ripples
    for (const rp of ripples) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${(rp.life / rp.maxLife) * 0.55})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Flowers
    for (const f of flowers) {
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f59f00';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Obstacles
    for (const obs of obstacles) {
      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.ellipse(obs.x + 4, obs.y + obs.r * 0.65, obs.r * 1.02, obs.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      if (obs.type === 'hay') {
        ctx.fillStyle = '#e0b354';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#b5842c';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Rope lines
        ctx.strokeStyle = '#8c5a1b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(obs.x - obs.r * 0.7, obs.y - 6);
        ctx.lineTo(obs.x + obs.r * 0.7, obs.y - 6);
        ctx.moveTo(obs.x - obs.r * 0.7, obs.y + 6);
        ctx.lineTo(obs.x + obs.r * 0.7, obs.y + 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#868e96';
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#adb5bd';
        ctx.beginPath();
        ctx.arc(obs.x - 5, obs.y - 5, obs.r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#495057';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Wooden fence border
    ctx.strokeStyle = '#7c4d25';
    ctx.lineWidth = 10;
    ctx.strokeRect(FENCE - 10, FENCE - 10, W - (FENCE - 10) * 2, H - (FENCE - 10) * 2);

    ctx.fillStyle = '#a06735';
    for (let x = FENCE - 10; x <= W - FENCE + 10; x += 48) {
      ctx.fillRect(x - 6, FENCE - 18, 12, 16);
      ctx.fillRect(x - 6, H - FENCE + 2, 12, 16);
    }
    for (let y = FENCE - 10; y <= H - FENCE + 10; y += 48) {
      ctx.fillRect(FENCE - 18, y - 6, 16, 12);
      ctx.fillRect(W - FENCE + 2, y - 6, 16, 12);
    }
  }

  function drawPoop(poop) {
    const fade = poop.life < 2.5 ? clamp(poop.life / 2.5, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(poop.x, poop.y);

    // Shadow / splat base
    ctx.fillStyle = 'rgba(65, 42, 18, 0.32)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Poop swirl layers (bottom -> middle -> top)
    ctx.fillStyle = '#6f4518';
    ctx.strokeStyle = '#3d240b';
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.ellipse(0, 2, 10.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#855320';
    ctx.beginPath();
    ctx.ellipse(0, -2, 7.5, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#9c662d';
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(0, -11, 4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Wavy green stink lines
    ctx.strokeStyle = 'rgba(148, 216, 45, 0.85)';
    ctx.lineWidth = 1.6;
    for (let s = -1; s <= 1; s += 2) {
      const wave = Math.sin(poop.wobble + s) * 2.5;
      ctx.beginPath();
      ctx.moveTo(s * 5, -9);
      ctx.quadraticCurveTo(s * 5 + wave, -14, s * 5 - wave * 0.6, -19);
      ctx.stroke();
    }

    // Tiny orbiting fly
    const flyX = Math.cos(poop.wobble * 1.4) * 11;
    const flyY = -12 + Math.sin(poop.wobble * 2.1) * 4;
    ctx.fillStyle = '#1f1f1f';
    ctx.beginPath();
    ctx.arc(flyX, flyY, 1.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawTauntBubble(d) {
    if (d.tauntTimer <= 0 || !d.tauntText) return;
    const alpha = d.tauntTimer < 0.35 ? d.tauntTimer / 0.35 : 1;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.font = '800 12px Segoe UI, sans-serif';
    const textW = ctx.measureText(d.tauntText).width;
    const padX = 10;
    const boxW = textW + padX * 2;
    const boxH = 24;

    const bx = clamp(d.x, FENCE + boxW / 2 + 4, W - FENCE - boxW / 2 - 4);
    const by = Math.max(FENCE + boxH + 6, d.y - (d.flyHeight || 0) - 34);

    // Bubble background
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1b3d2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(bx - boxW / 2, by - boxH / 2, boxW, boxH, 10);
    ctx.fill();
    ctx.stroke();

    // Little pointer triangle
    const tipX = clamp(d.x, bx - boxW / 2 + 10, bx + boxW / 2 - 10);
    ctx.beginPath();
    ctx.moveTo(tipX - 5, by + boxH / 2 - 1);
    ctx.lineTo(tipX, by + boxH / 2 + 6);
    ctx.lineTo(tipX + 5, by + boxH / 2 - 1);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    // Cover seam line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(tipX - 4, by + boxH / 2 - 2.5, 8, 3);

    // Text
    ctx.fillStyle = '#1a2e22';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.tauntText, bx, by + 0.5);
    ctx.restore();
  }

  function drawDuck(d) {
    const isFlying = d.type === 'flyer' && d.flyTimer > 0;
    const flyY = d.flyHeight || 0;
    const bob = isFlying ? 0 : Math.sin(d.waddle) * (d.panicked ? 3.2 : 1.5);
    const tilt = isFlying ? -0.15 : Math.sin(d.waddle) * (d.panicked ? 0.2 : 0.08);
    const inWater = !isFlying && isInPond(d.x, d.y);

    // Ground shadow (stays on ground & shrinks slightly as duck flies higher!)
    if (!inWater) {
      ctx.save();
      ctx.translate(d.x, d.y);
      const shadowScale = clamp(1 - flyY / 95, 0.45, 1);
      ctx.fillStyle = `rgba(0, 0, 0, ${0.22 * shadowScale})`;
      ctx.beginPath();
      ctx.ellipse(0, 11, 13 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(d.x, d.y + bob - flyY);
    if (isFlying) {
      const airScale = 1 + (flyY / 56) * 0.22;
      ctx.scale(airScale, airScale);
    }

    ctx.rotate(tilt);
    ctx.scale(d.facingX, 1);

    // Colors by variant
    const bodyColor =
      d.type === 'gold'
        ? '#fcc419'
        : d.type === 'fast'
          ? '#f8f9fa'
          : d.type === 'flyer'
            ? '#74c0fc'
            : d.type === 'ninja'
              ? '#343a40'
              : d.type === 'pooper'
                ? '#c28b59'
                : '#ffe066';
    const wingColor =
      d.type === 'gold'
        ? '#f08c00'
        : d.type === 'fast'
          ? '#dee2e6'
          : d.type === 'flyer'
            ? '#339af0'
            : d.type === 'ninja'
              ? '#212529'
              : d.type === 'pooper'
                ? '#8c5a2b'
                : '#f5b82e';

    // Golden aura
    if (d.type === 'gold') {
      ctx.fillStyle = 'rgba(255, 212, 59, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, Math.PI * 2);
      ctx.fill();
    }

    // Flyer ready subtle sky glow
    if (d.type === 'flyer' && d.flyCooldown <= 0 && !isFlying) {
      ctx.strokeStyle = 'rgba(116, 192, 252, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Feet (when grounded & not in water)
    if (!inWater && !isFlying) {
      ctx.fillStyle = '#f76707';
      const step = Math.sin(d.waddle) * 4;
      ctx.fillRect(-5 + step, 8, 5, 4);
      ctx.fillRect(2 - step, 8, 5, 4);
    }

    // Back wing when flying!
    if (isFlying) {
      const backFlap = Math.sin(d.waddle * 1.4) * 11;
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      ctx.ellipse(2, -4 - backFlap, 11, 5, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(-1, 2, 13, 9.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(-18, -5);
    ctx.lineTo(-13, 5);
    ctx.closePath();
    ctx.fillStyle = bodyColor;
    ctx.fill();

    // Flapping Wing
    const flapY = isFlying
      ? Math.sin(d.waddle * 1.4) * 10
      : d.panicked
        ? Math.sin(d.waddle * 2.2) * 5
        : 0;
    ctx.fillStyle = wingColor;
    ctx.beginPath();
    ctx.ellipse(-2, 2 + flapY, isFlying ? 11 : 7, isFlying ? 5.5 : 4.5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.arc(8, -7, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Variant Accessories on head
    if (d.type === 'ninja') {
      // Red ninja headband + trailing ribbon
      ctx.fillStyle = '#e03131';
      ctx.fillRect(0, -12, 15, 3.2);
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(-8, -14);
      ctx.lineTo(-6, -8);
      ctx.closePath();
      ctx.fill();
    } else if (d.type === 'flyer') {
      // Aviator goggles band
      ctx.strokeStyle = '#495057';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(1, -11);
      ctx.lineTo(14, -11);
      ctx.stroke();
      ctx.fillStyle = '#e7f5ff';
      ctx.beginPath();
      ctx.arc(10.5, -11, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (d.type === 'pooper') {
      // Cheeky green stink blush
      ctx.fillStyle = 'rgba(148, 216, 45, 0.75)';
      ctx.beginPath();
      ctx.arc(7, -4.5, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Beak
    ctx.fillStyle = '#ff6b00';
    ctx.beginPath();
    ctx.ellipse(16, -6, 5.5, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye (smug squinting eye when taunting!)
    if (d.smugTimer > 0) {
      ctx.strokeStyle = d.type === 'ninja' ? '#ffd43b' : '#1a1a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(8.5, -10);
      ctx.lineTo(12.5, -8.5);
      ctx.lineTo(8.5, -7);
      ctx.stroke();
    } else {
      ctx.fillStyle = d.type === 'ninja' ? '#ffd43b' : '#1a1a1a';
      ctx.beginPath();
      ctx.arc(10.5, -9, 1.8, 0, Math.PI * 2);
      ctx.fill();
      if (d.type !== 'ninja') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(11.1, -9.6, 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Quack bubble when startled (only if not showing a taunt bubble)
    if (d.quackBubble > 0 && d.tauntTimer <= 0) {
      ctx.save();
      ctx.font = 'bold 12px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1b3d2b';
      ctx.lineWidth = 3;
      ctx.strokeText('Kwek!', d.x, d.y - flyY - 22);
      ctx.fillText('Kwek!', d.x, d.y - flyY - 22);
      ctx.restore();
    }
  }

  function drawPlayer() {
    const bob = Math.sin(player.walkCycle) * 2.2;
    const angle = Math.atan2(player.facingY, player.facingX);

    ctx.save();
    ctx.translate(player.x, player.y);

    // Poop slow aura around player's feet
    if (player.slowTimer > 0) {
      ctx.fillStyle = 'rgba(130, 92, 42, 0.35)';
      ctx.strokeStyle = 'rgba(148, 216, 45, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 12, 22, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Dash ring
    if (player.dashTime > 0) {
      ctx.strokeStyle = 'rgba(255, 224, 102, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, player.r + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Catching net in front of player
    ctx.save();
    ctx.rotate(angle);
    ctx.strokeStyle = '#8c5a2b';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(24, 10);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.strokeStyle = '#e9ecef';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(29, 10, 8, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Body (Blue overalls)
    ctx.translate(0, bob);
    ctx.fillStyle = '#228be6';
    ctx.beginPath();
    ctx.arc(0, 2, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1864ab';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Straw Hat
    ctx.fillStyle = '#f3d06b';
    ctx.beginPath();
    ctx.arc(0, -3, 15.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c29225';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hat ribbon
    ctx.strokeStyle = '#e03131';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -3, 9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f8df8c';
    ctx.beginPath();
    ctx.arc(0, -3, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function render() {
    ctx.save();
    if (screenShake > 0) {
      const sx = (Math.random() - 0.5) * screenShake;
      const sy = (Math.random() - 0.5) * screenShake;
      ctx.translate(sx, sy);
    }

    drawArena();

    // Draw poops on the ground
    for (const poop of poops) drawPoop(poop);

    // Sort entities by Y for natural depth overlap (airborne ducks always draw on top)
    const renderList = [
      ...ducks.map((d) => ({ y: d.y + (d.flyTimer > 0 ? 1000 : 0), draw: () => drawDuck(d) })),
      { y: player.y, draw: () => drawPlayer() },
    ];
    renderList.sort((a, b) => a.y - b.y);
    for (const item of renderList) item.draw();

    // Draw taunt speech bubbles on top so they are always readable
    for (const d of ducks) drawTauntBubble(d);

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating texts
    for (const ft of floatingTexts) {
      ctx.save();
      ctx.globalAlpha = clamp(ft.life / ft.maxLife, 0, 1);
      ctx.font = '800 17px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  // ---- Main Loop ----
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---- Events ----
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    keys[e.code] = true;

    if (state === 'win') {
      if (e.code === 'Digit1') pickUpgradeCard(0);
      else if (e.code === 'Digit2') pickUpgradeCard(1);
      else if (e.code === 'Digit3') pickUpgradeCard(2);
      return;
    }

    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      triggerDash();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing' || state === 'paused') togglePause();
    } else if (e.code === 'KeyR') {
      if (state === 'playing' || state === 'paused' || state === 'gameover') {
        startNewGame();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
  });

  // UI Buttons
  document.getElementById('btn-start').addEventListener('click', startNewGame);
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart-pause').addEventListener('click', startNewGame);
  document.getElementById('btn-retry').addEventListener('click', startNewGame);
  document.getElementById('btn-menu').addEventListener('click', () => {
    state = 'start';
    resetUpgrades();
    setupLevel(1);
    showOverlay(overlayStart);
  });

  btnPause.addEventListener('click', () => {
    if (state === 'playing' || state === 'paused') togglePause();
  });

  btnSound.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    btnSound.textContent = soundEnabled ? '🔊' : '🔇';
  });

  document.querySelectorAll('.diff-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
      setupLevel(1);
    });
  });

  // Init
  startHighscore.textContent = highScore;
  resetUpgrades();
  setupLevel(1);
  requestAnimationFrame(loop);
})();
