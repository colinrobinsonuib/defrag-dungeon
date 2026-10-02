/**
 * AI Arcane Forge: Magic Potion Synthesizer
 * Defrag Dungeon - Room 2
 */

(function () {
  'use strict';

  // --- AUDIO SYNTHESIS ENGINE (Web Audio API) ---
  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.muted = false;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      return !this.muted;
    }

    playClick() {
      if (this.muted || !this.ctx) return;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch (e) {}
    }

    playBuy() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(660, now + 0.06);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.15);
      } catch (e) {}
    }

    playResearch() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.14, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.22);
        });
      } catch (e) {}
    }

    playBreakthrough() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.15);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.26);
      } catch (e) {}
    }

    playOverclock() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.4);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(now + 0.5);
      } catch (e) {}
    }

    playVictory() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const chord = [523.25, 659.25, 783.99, 987.77, 1046.50];
        chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 1.2);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 1.3);
        });
      } catch (e) {}
    }

    playDefeat() {
      if (this.muted || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const tones = [440, 392, 349.23, 293.66];
        tones.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.15, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.36);
        });
      } catch (e) {}
    }
  }

  const sound = new SoundEngine();

  // --- GAME STATE ---
  const state = {
    started: false,
    finished: false,
    startTime: 0,
    timeLimit: 100.0, // seconds
    remainingTime: 100.0,

    compute: 0,
    totalCompute: 0,
    clickBase: 1,
    clickMultiplier: 1,
    passiveMultiplier: 1,
    globalMultiplier: 1,

    overclockActive: false,
    overclockTimer: 0,

    breakthroughsCollected: 0,
    nextBreakthroughTime: 0,

    currentTier: 0,
    potency: 0, // 0 to 100

    upgrades: [
      {
        id: 'gpu',
        title: 'GPU Cluster',
        desc: '+2 FLOPs/s',
        baseCost: 15,
        baseOutput: 2,
        count: 0,
        costMult: 1.15,
        dom: null
      },
      {
        id: 'tpu',
        title: 'TPU Pod',
        desc: '+12 FLOPs/s',
        baseCost: 100,
        baseOutput: 12,
        count: 0,
        costMult: 1.15,
        dom: null
      },
      {
        id: 'quantum',
        title: 'Quantum Neural Array',
        desc: '+65 FLOPs/s',
        baseCost: 550,
        baseOutput: 65,
        count: 0,
        costMult: 1.15,
        dom: null
      },
      {
        id: 'planetary',
        title: 'Planetary Datacenter',
        desc: '+340 FLOPs/s',
        baseCost: 2600,
        baseOutput: 340,
        count: 0,
        costMult: 1.15,
        dom: null
      }
    ],

    researchTiers: [
      {
        tier: 1,
        title: 'Catalyst Binding',
        benefit: '+20% Potency, Click Power ×2',
        cost: 50,
        completed: false,
        dom: null,
        onUnlock: () => {
          state.clickMultiplier *= 2;
          state.potency = 20;
          state.currentTier = 1;
        }
      },
      {
        tier: 2,
        title: 'Vapor Diffusion',
        benefit: '+20% Potency, Hardware Rate +50%',
        cost: 260,
        completed: false,
        dom: null,
        onUnlock: () => {
          state.passiveMultiplier *= 1.5;
          state.potency = 40;
          state.currentTier = 2;
        }
      },
      {
        tier: 3,
        title: 'Shimmer Veil',
        benefit: '+20% Potency, Breakthroughs 2× more frequent',
        cost: 1350,
        completed: false,
        dom: null,
        onUnlock: () => {
          state.potency = 60;
          state.currentTier = 3;
        }
      },
      {
        tier: 4,
        title: 'Arcane Surge Infusion',
        benefit: '+20% Potency, Total Compute Rate ×2',
        cost: 5200,
        completed: false,
        dom: null,
        onUnlock: () => {
          state.globalMultiplier *= 2;
          state.potency = 80;
          state.currentTier = 4;
        }
      },
      {
        tier: 5,
        title: 'APEX ELIXIR SYNTHESIS',
        benefit: '+20% Potency (100%), Win Experiment!',
        cost: 15000,
        completed: false,
        dom: null,
        onUnlock: () => {
          state.potency = 100;
          state.currentTier = 5;
          triggerVictory();
        }
      }
    ]
  };

  // --- DOM REFERENCES ---
  const timerDisplay = document.getElementById('timer-display');
  const timerBadge = document.getElementById('timer-badge');
  const muteBtn = document.getElementById('mute-btn');
  const guideBtn = document.getElementById('guide-btn');
  const tierBadge = document.getElementById('tier-badge');
  const potencyPct = document.getElementById('potency-pct');
  const potencyBar = document.getElementById('potency-bar');
  const computeDisplay = document.getElementById('compute-display');
  const rateDisplay = document.getElementById('rate-display');
  const neuralCoreBtn = document.getElementById('neural-core');
  const upgradeList = document.getElementById('upgrade-list');
  const researchList = document.getElementById('research-list');
  const logText = document.getElementById('log-text');
  const abortBtn = document.getElementById('abort-btn');
  const standbyOverlay = document.getElementById('standby-overlay');
  const tutorialOverlay = document.getElementById('tutorial-overlay');
  const closeTutorialBtn = document.getElementById('close-tutorial-btn');
  const resultOverlay = document.getElementById('result-overlay');
  const resultCard = document.getElementById('result-card');
  const resultTitle = document.getElementById('result-title');
  const resultDesc = document.getElementById('result-desc');
  const resultStats = document.getElementById('result-stats');
  const breakthroughOrb = document.getElementById('breakthrough-orb');
  const overclockIndicator = document.getElementById('overclock-indicator');
  const canvas = document.getElementById('potion-canvas');
  const ctx = canvas.getContext('2d');

  // --- COMPUTE CALCULATIONS ---
  function getEffectivePassiveRate() {
    let base = 0;
    state.upgrades.forEach(u => {
      base += u.count * u.baseOutput;
    });
    let rate = base * state.passiveMultiplier * state.globalMultiplier;
    if (state.overclockActive) {
      rate *= 3;
    }
    return rate;
  }

  function getEffectiveClickPower() {
    let power = state.clickBase * state.clickMultiplier * state.globalMultiplier;
    if (state.overclockActive) {
      power *= 3;
    }
    return power;
  }

  function getUpgradeCost(upgrade) {
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMult, upgrade.count));
  }

  // --- LOGGING ---
  function setLog(msg) {
    if (logText) {
      logText.textContent = msg;
    }
  }

  // --- FLOATING TEXT ANIMATION ---
  function spawnFloatingText(text, x, y, color = '#34d399') {
    const el = document.createElement('div');
    el.className = 'floating-num';
    el.textContent = text;
    el.style.color = color;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 800);
  }

  // --- INITIALIZE UI DOM NODES ONCE ---
  function initUpgradesDOM() {
    upgradeList.innerHTML = '';
    state.upgrades.forEach(u => {
      const card = document.createElement('div');
      card.className = 'upgrade-card';

      card.innerHTML = `
        <div class="upgrade-info">
          <span class="upgrade-title">${u.title}</span>
          <span class="upgrade-desc">${u.desc}</span>
          <span class="upgrade-count">Active: 0</span>
        </div>
        <div class="upgrade-cost">0 FLOPs</div>
      `;

      const countEl = card.querySelector('.upgrade-count');
      const costEl = card.querySelector('.upgrade-cost');

      // Click handler
      card.addEventListener('click', (e) => {
        if (!state.started || state.finished) return;
        sound.init();
        const cost = getUpgradeCost(u);
        if (state.compute >= cost) {
          state.compute -= cost;
          u.count += 1;
          sound.playBuy();
          setLog(`Deployed ${u.title}. Automated compute escalated.`);
          const rect = card.getBoundingClientRect();
          spawnFloatingText(`+${u.baseOutput} FLOPs/s`, rect.left + 50, rect.top, '#06b6d4');
          updateUI();
        } else {
          const rect = card.getBoundingClientRect();
          spawnFloatingText(`Need ${cost - Math.floor(state.compute)} more`, rect.left + 50, rect.top, '#f43f5e');
        }
      });

      u.dom = { card, countEl, costEl };
      upgradeList.appendChild(card);
    });
  }

  function initResearchDOM() {
    researchList.innerHTML = '';
    state.researchTiers.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = 'research-card locked';

      card.innerHTML = `
        <div class="res-info">
          <div class="res-header">
            <span class="res-tag">TIER ${r.tier}</span>
            <span class="res-title">${r.title}</span>
          </div>
          <div class="res-benefit">${r.benefit}</div>
        </div>
        <button class="res-action-btn btn-locked">LOCKED</button>
      `;

      const btn = card.querySelector('.res-action-btn');

      // Unified card & button click handler
      function handlePurchaseAttempt(e) {
        if (!state.started || state.finished) return;
        sound.init();

        const prevTierDone = idx === 0 || state.researchTiers[idx - 1].completed;
        if (r.completed) return;

        if (!prevTierDone) {
          const rect = card.getBoundingClientRect();
          spawnFloatingText(`Unlock Tier ${r.tier - 1} first!`, rect.left + 80, rect.top, '#f43f5e');
          return;
        }

        if (state.compute >= r.cost) {
          state.compute -= r.cost;
          r.completed = true;
          r.onUnlock();
          sound.playResearch();
          setLog(`✦ RESEARCHED TIER ${r.tier}: ${r.title}! Potion potency escalated to ${state.potency}%!`);
          const rect = card.getBoundingClientRect();
          spawnFloatingText(`+20% POTENCY!`, rect.left + 80, rect.top, '#c084fc');
          updateUI();
        } else {
          const needed = Math.ceil(r.cost - state.compute);
          const rect = card.getBoundingClientRect();
          spawnFloatingText(`Need ${needed.toLocaleString()} more FLOPs!`, rect.left + 80, rect.top, '#f43f5e');
        }
      }

      card.addEventListener('click', handlePurchaseAttempt);
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePurchaseAttempt(e);
      });

      r.dom = { card, btn };
      researchList.appendChild(card);
    });
  }

  // --- REACTIVE UI UPDATER (NO DOM RECREATION) ---
  function updateUI() {
    // 1. Compute stats
    computeDisplay.textContent = `${Math.floor(state.compute).toLocaleString()} FLOPs`;
    const rate = getEffectivePassiveRate();
    rateDisplay.textContent = `+${rate.toFixed(1)} FLOPs/s`;

    // 2. Potency display
    potencyPct.textContent = `${state.potency}%`;
    potencyBar.style.width = `${state.potency}%`;

    const tierNames = [
      'TIER 0: RAW SLAG',
      'TIER 1: CATALYST BOUND',
      'TIER 2: VAPOR DIFFUSED',
      'TIER 3: SHIMMER VEILED',
      'TIER 4: ARCANE SURGE',
      'TIER 5: APEX ELIXIR'
    ];
    tierBadge.textContent = tierNames[state.currentTier] || `TIER ${state.currentTier}`;

    // 3. Upgrades state
    state.upgrades.forEach(u => {
      if (!u.dom) return;
      const cost = getUpgradeCost(u);
      const canAfford = state.compute >= cost;

      u.dom.card.classList.toggle('disabled', !canAfford);
      u.dom.countEl.textContent = `Active: ${u.count}`;
      u.dom.costEl.textContent = `${cost.toLocaleString()} FLOPs`;
    });

    // 4. Research tiers state
    state.researchTiers.forEach((r, idx) => {
      if (!r.dom) return;
      const prevTierDone = idx === 0 || state.researchTiers[idx - 1].completed;
      const isNext = prevTierDone && !r.completed;
      const canAfford = state.compute >= r.cost && isNext;

      // Update card classes
      r.dom.card.classList.remove('completed', 'can-afford', 'needs-flops', 'locked');
      r.dom.btn.classList.remove('btn-done', 'btn-ready', 'btn-needs-flops', 'btn-locked');

      if (r.completed) {
        r.dom.card.classList.add('completed');
        r.dom.btn.classList.add('btn-done');
        r.dom.btn.textContent = '✔ COMPLETED';
        r.dom.btn.disabled = true;
      } else if (isNext) {
        if (canAfford) {
          r.dom.card.classList.add('can-afford');
          r.dom.btn.classList.add('btn-ready');
          r.dom.btn.textContent = `⚡ RESEARCH (${r.cost.toLocaleString()} FLOPs)`;
          r.dom.btn.disabled = false;
        } else {
          r.dom.card.classList.add('needs-flops');
          r.dom.btn.classList.add('btn-needs-flops');
          const needed = Math.ceil(r.cost - state.compute);
          r.dom.btn.textContent = `NEED ${needed.toLocaleString()} MORE FLOPs`;
          r.dom.btn.disabled = false;
        }
      } else {
        r.dom.card.classList.add('locked');
        r.dom.btn.classList.add('btn-locked');
        r.dom.btn.textContent = `LOCKED (TIER ${r.tier - 1} REQ)`;
        r.dom.btn.disabled = true;
      }
    });
  }

  // --- NEURAL CORE CLICK ---
  neuralCoreBtn.addEventListener('click', (e) => {
    if (!state.started || state.finished) return;
    sound.init();
    const gain = getEffectiveClickPower();
    state.compute += gain;
    state.totalCompute += gain;
    sound.playClick();

    const rect = neuralCoreBtn.getBoundingClientRect();
    const spawnX = rect.left + rect.width / 2 + (Math.random() * 40 - 20);
    const spawnY = rect.top + (Math.random() * 20 - 10);
    spawnFloatingText(`+${Math.floor(gain)}`, spawnX, spawnY);

    updateUI();
  });

  // --- NEURAL BREAKTHROUGH ANOMALY ---
  function scheduleNextBreakthrough() {
    const baseInterval = state.currentTier >= 3 ? 5000 : 9000;
    const jitter = Math.random() * 3000;
    state.nextBreakthroughTime = performance.now() + baseInterval + jitter;
  }

  function spawnBreakthroughOrb() {
    if (!state.started || state.finished) return;
    const padding = 60;
    const maxX = window.innerWidth - padding - 60;
    const maxY = window.innerHeight - padding - 100;
    const x = Math.max(padding, Math.floor(Math.random() * maxX));
    const y = Math.max(80, Math.floor(Math.random() * maxY));

    breakthroughOrb.style.left = `${x}px`;
    breakthroughOrb.style.top = `${y}px`;
    breakthroughOrb.classList.remove('hidden');

    sound.playBreakthrough();

    // Auto despawn after 4.5 seconds if unclicked
    const despawnTimeout = setTimeout(() => {
      hideBreakthroughOrb();
      scheduleNextBreakthrough();
    }, 4500);

    breakthroughOrb.onclick = (e) => {
      clearTimeout(despawnTimeout);
      e.stopPropagation();
      onBreakthroughClicked(x, y);
    };
  }

  function hideBreakthroughOrb() {
    breakthroughOrb.classList.add('hidden');
    breakthroughOrb.onclick = null;
  }

  function onBreakthroughClicked(x, y) {
    if (!state.started || state.finished) return;
    sound.init();
    hideBreakthroughOrb();
    state.breakthroughsCollected++;

    // 50% chance Overclock Mode, 50% chance Instant Compute Windfall
    const isOverclock = Math.random() < 0.5;

    if (isOverclock) {
      state.overclockActive = true;
      state.overclockTimer = 6.0; // 6 seconds
      overclockIndicator.classList.remove('hidden');
      sound.playOverclock();
      setLog('⚡ NEURAL OVERCLOCK TRIGGERED! 3× Compute for 6s!');
      spawnFloatingText('⚡ 3× OVERCLOCK!', x, y, '#f59e0b');
    } else {
      const passive = getEffectivePassiveRate();
      const windfall = Math.max(120, Math.floor(passive * 14 + 100));
      state.compute += windfall;
      state.totalCompute += windfall;
      sound.playBreakthrough();
      setLog(`✦ Breakthrough decoded! +${windfall} instant FLOPs!`);
      spawnFloatingText(`+${windfall} FLOPs!`, x, y, '#f59e0b');
    }

    updateUI();
    scheduleNextBreakthrough();
  }

  // --- CANVAS POTION VISUALIZER ---
  const particles = [];
  const runes = ['✦', '✧', '⚛', '⬡', 'ᚱ', 'ᛟ', 'ᚷ', 'ᛉ'];
  let animAngle = 0;

  function initParticles() {
    for (let i = 0; i < 24; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2.5 + 1,
        speedY: Math.random() * 0.8 + 0.3,
        alpha: Math.random() * 0.7 + 0.2
      });
    }
  }
  initParticles();

  function renderPotionCanvas(timeSec) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2 + 10;

    // Flask geometry
    const flaskRadius = 55;
    const neckW = 26;
    const neckH = 35;
    const neckTop = centerY - flaskRadius - neckH + 10;

    // Fluid height proportional to potency (from 15% to 85%)
    const fluidRatio = 0.15 + (state.potency / 100) * 0.70;
    const fluidY = (centerY + flaskRadius) - (flaskRadius * 2 * fluidRatio);

    // Color palette based on tier
    let fluidColor1, fluidColor2, glowColor;
    if (state.currentTier === 0) {
      fluidColor1 = '#064e3b';
      fluidColor2 = '#022c22';
      glowColor = '#10b98144';
    } else if (state.currentTier === 1) {
      fluidColor1 = '#059669';
      fluidColor2 = '#047857';
      glowColor = '#10b98188';
    } else if (state.currentTier === 2) {
      fluidColor1 = '#0d9488';
      fluidColor2 = '#0891b2';
      glowColor = '#06b6d488';
    } else if (state.currentTier === 3) {
      fluidColor1 = '#7c3aed';
      fluidColor2 = '#4c1d95';
      glowColor = '#a855f799';
    } else if (state.currentTier === 4) {
      fluidColor1 = '#c026d3';
      fluidColor2 = '#7c3aed';
      glowColor = '#ec4899aa';
    } else {
      // Apex
      fluidColor1 = '#fbbf24';
      fluidColor2 = '#ec4899';
      glowColor = '#f59e0baa';
    }

    // Draw ambient flask glow
    const glowGrad = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, flaskRadius + 30);
    glowGrad.addColorStop(0, glowColor);
    glowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, flaskRadius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Clip to Flask interior
    ctx.save();
    ctx.beginPath();
    // Neck
    ctx.rect(centerX - neckW / 2, neckTop, neckW, neckH + 5);
    // Spherical bulb
    ctx.arc(centerX, centerY, flaskRadius, 0, Math.PI * 2);
    ctx.clip();

    // Draw Fluid interior
    const fluidGrad = ctx.createLinearGradient(centerX, fluidY, centerX, centerY + flaskRadius);
    fluidGrad.addColorStop(0, fluidColor1);
    fluidGrad.addColorStop(1, fluidColor2);
    ctx.fillStyle = fluidGrad;

    // Fluid wave surface
    ctx.beginPath();
    ctx.moveTo(centerX - flaskRadius, centerY + flaskRadius);
    const waveAmp = 3.5;
    const waveFreq = 0.05;
    for (let x = centerX - flaskRadius; x <= centerX + flaskRadius; x += 4) {
      const y = fluidY + Math.sin(timeSec * 4 + x * waveFreq) * waveAmp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(centerX + flaskRadius, centerY + flaskRadius + 10);
    ctx.closePath();
    ctx.fill();

    // Floating bubbles inside fluid
    particles.forEach(p => {
      p.y -= p.speedY;
      if (p.y < fluidY) {
        p.y = centerY + flaskRadius - 5;
        p.x = centerX - flaskRadius * 0.7 + Math.random() * (flaskRadius * 1.4);
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
      ctx.fill();
    });

    // Central pulsing alchemical core inside fluid
    const pulseScale = 1 + Math.sin(timeSec * 5) * 0.15;
    const coreRad = (8 + state.currentTier * 2.5) * pulseScale;
    const coreGrad = ctx.createRadialGradient(centerX, centerY + 10, 0, centerX, centerY + 10, coreRad);
    coreGrad.addColorStop(0, '#ffffff');
    coreGrad.addColorStop(0.5, fluidColor1);
    coreGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY + 10, coreRad, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Flask Glass Outline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 12;

    // Flask bulb outline
    ctx.beginPath();
    ctx.arc(centerX, centerY, flaskRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Flask neck outline & lip
    ctx.beginPath();
    ctx.moveTo(centerX - neckW / 2, centerY - flaskRadius + 8);
    ctx.lineTo(centerX - neckW / 2, neckTop);
    ctx.lineTo(centerX - neckW / 2 - 4, neckTop);
    ctx.lineTo(centerX + neckW / 2 + 4, neckTop);
    ctx.lineTo(centerX + neckW / 2, neckTop);
    ctx.lineTo(centerX + neckW / 2, centerY - flaskRadius + 8);
    ctx.stroke();

    ctx.shadowBlur = 0; // reset

    // Orbiting Runes around flask
    animAngle += 0.015;
    const runeCount = 4 + state.currentTier;
    const orbitRadius = flaskRadius + 24;
    ctx.font = '12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillStyle = state.currentTier >= 3 ? '#c084fc' : '#34d399';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < runeCount; i++) {
      const angle = animAngle + (i * (Math.PI * 2 / runeCount));
      const rx = centerX + Math.cos(angle) * orbitRadius;
      const ry = centerY + Math.sin(angle) * (orbitRadius * 0.45);
      const runeChar = runes[i % runes.length];
      ctx.fillText(runeChar, rx, ry);
    }
  }

  // --- GAME LOOP & CLOCK ---
  let lastTime = 0;

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    if (state.started && !state.finished) {
      // 1. Passive Compute Accumulation
      const passiveRate = getEffectivePassiveRate();
      const earned = passiveRate * dt;
      state.compute += earned;
      state.totalCompute += earned;

      // 2. Overclock Timer
      if (state.overclockActive) {
        state.overclockTimer -= dt;
        if (state.overclockTimer <= 0) {
          state.overclockActive = false;
          overclockIndicator.classList.add('hidden');
          setLog('Overclock dissipated. Normal compute rate restored.');
        }
      }

      // 3. Breakthrough Spawning
      if (timestamp >= state.nextBreakthroughTime) {
        spawnBreakthroughOrb();
      }

      // 4. Timer Countdown (100 seconds hard limit)
      const elapsed = (timestamp - state.startTime) / 1000;
      state.remainingTime = Math.max(0, state.timeLimit - elapsed);
      timerDisplay.textContent = `${state.remainingTime.toFixed(1)}s`;

      if (state.remainingTime <= 15) {
        timerBadge.classList.add('warning');
      }

      // Timeout detection
      if (state.remainingTime <= 0) {
        triggerTimeout();
      }

      updateUI();
    }

    // Render Canvas
    renderPotionCanvas(timestamp / 1000);

    requestAnimationFrame(gameLoop);
  }

  // --- COMPLETION & POSTMESSAGE PROTOCOL ---
  function reportResult(success, resultText) {
    window.parent.postMessage({
      type: 'defrag:complete',
      success: Boolean(success),
      result: String(resultText)
    }, '*');
  }

  function triggerVictory() {
    if (state.finished) return;
    state.finished = true;
    sound.playVictory();

    const elapsed = ((performance.now() - state.startTime) / 1000).toFixed(1);
    const resultMsg = `Apex Elixir synthesized in ${elapsed}s! Reached peak ${getEffectivePassiveRate().toFixed(0)} FLOPs/s with ${state.breakthroughsCollected} breakthroughs.`;

    resultTitle.textContent = '✦ APEX ELIXIR CRAFTED! ✦';
    resultDesc.textContent = 'Transmutation Complete. The Arcane Forge is fully defragged!';
    resultStats.innerHTML = `
      <div>Time Taken: <strong>${elapsed}s</strong></div>
      <div>Total Compute: <strong>${Math.floor(state.totalCompute).toLocaleString()} FLOPs</strong></div>
      <div>Breakthroughs Caught: <strong>${state.breakthroughsCollected}</strong></div>
    `;
    resultCard.className = 'overlay-card success';
    resultOverlay.classList.remove('hidden');

    setLog('★ APEX ELIXIR SYNTHESIZED! Mission Accomplished!');
    reportResult(true, resultMsg);
  }

  function triggerTimeout() {
    if (state.finished) return;
    state.finished = true;
    sound.playDefeat();

    const resultMsg = `Experiment timed out at Tier ${state.currentTier} (${state.potency}% potency). Total FLOPs: ${Math.floor(state.totalCompute)}.`;

    resultTitle.textContent = 'EXPERIMENT TIMED OUT';
    resultDesc.textContent = '100.0s elapsed. The potion destabilized before reaching Apex state.';
    resultStats.innerHTML = `
      <div>Highest Tier: <strong>Tier ${state.currentTier}</strong></div>
      <div>Potency Achieved: <strong>${state.potency}%</strong></div>
      <div>Total FLOPs: <strong>${Math.floor(state.totalCompute).toLocaleString()}</strong></div>
    `;
    resultCard.className = 'overlay-card failure';
    resultOverlay.classList.remove('hidden');

    setLog('Experiment timed out. Destabilization detected.');
    reportResult(false, resultMsg);
  }

  function triggerAbort() {
    if (state.finished) return;
    state.finished = true;
    sound.playDefeat();

    const resultMsg = `Operator aborted experiment at Tier ${state.currentTier} (${state.potency}% potency).`;

    resultTitle.textContent = 'EXPERIMENT ABORTED';
    resultDesc.textContent = 'Synthesis aborted by user intervention.';
    resultCard.className = 'overlay-card failure';
    resultOverlay.classList.remove('hidden');

    setLog('Manual experiment abort sequence confirmed.');
    reportResult(false, resultMsg);
  }

  // --- HOST COMMUNICATION CONTRACT ---
  function startGame() {
    if (state.started) return;
    sound.init();
    state.started = true;
    state.startTime = performance.now();
    standbyOverlay.classList.add('hidden');
    scheduleNextBreakthrough();
    setLog('Forge online! Click the core for FLOPs, buy hardware, and unlock tiers!');
    updateUI();
  }

  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'defrag:start') {
      startGame();
    }

    if (event.data.type === 'defrag:timeout') {
      // 5-second grace period: finalize score immediately
      triggerTimeout();
    }
  });

  // --- CONTROLS EVENT LISTENERS ---
  muteBtn.addEventListener('click', () => {
    const unmuted = sound.toggleMute();
    muteBtn.textContent = unmuted ? '🔊' : '🔇';
    muteBtn.title = unmuted ? 'Mute Sound' : 'Unmute Sound';
  });

  abortBtn.addEventListener('click', () => {
    if (!state.started || state.finished) return;
    triggerAbort();
  });

  guideBtn.addEventListener('click', () => {
    tutorialOverlay.classList.remove('hidden');
  });

  closeTutorialBtn.addEventListener('click', () => {
    tutorialOverlay.classList.add('hidden');
    if (!state.started) {
      startGame();
    }
  });

  // Standby click fallback for standalone manual browser testing
  standbyOverlay.addEventListener('click', () => {
    if (!state.started) {
      startGame();
    }
  });

  // Initial DOM building & loop start
  initUpgradesDOM();
  initResearchDOM();
  updateUI();
  requestAnimationFrame(gameLoop);

})();
