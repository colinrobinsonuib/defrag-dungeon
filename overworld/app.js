// Defrag Dungeon Cyber Overworld Host (Dark Mode & 3D Corridor Stage)

class BarebonesOverworld {
  constructor() {
    this.rooms = [];
    this.currentIndex = 0;
    this.viewIndex = 0;
    this.currentRoom = null;
    this.currentRoomIndex = 0;
    this.roomStates = {}; // roomId -> { state: 'locked'|'ready'|'cleared'|'failed', result: '' }

    this.TIMER_LIMIT_MS = 100000; // 100 seconds
    this.GRACE_LIMIT_MS = 5000;   // 5 seconds grace period
    this.timerStartTime = 0;
    this.timerInterval = null;
    this.graceInterval = null;
    this.isGameRunning = false;

    // DOM Elements
    this.roomListEl = document.getElementById('room-list');
    this.trackViewport = document.getElementById('track-viewport');
    this.trackDotsEl = document.getElementById('track-dots');
    this.progressIndicator = document.getElementById('progress-indicator');
    this.prevNavBtn = document.getElementById('prev-nav-btn');
    this.nextNavBtn = document.getElementById('next-nav-btn');
    this.stageArrowLeft = document.getElementById('stage-arrow-left');
    this.stageArrowRight = document.getElementById('stage-arrow-right');
    this.resetBtn = document.getElementById('reset-btn');
    this.shuffleBtn = document.getElementById('shuffle-btn');
    this.dungeonSummary = document.getElementById('dungeon-summary');
    this.summaryText = document.getElementById('summary-text');
    this.replayBtn = document.getElementById('replay-btn');

    // Overlay Elements
    this.overlay = document.getElementById('room-overlay');
    this.overlayColor = document.getElementById('overlay-color-indicator');
    this.overlayTitle = document.getElementById('overlay-title');
    this.overlayTimer = document.getElementById('overlay-timer');
    this.graceIndicator = document.getElementById('grace-indicator');
    this.startBtn = document.getElementById('start-btn');
    this.exitBtn = document.getElementById('exit-btn');
    this.roomIframe = document.getElementById('room-iframe');
    this.resultBanner = document.getElementById('result-banner');
    this.resultTitle = document.getElementById('result-title');
    this.resultText = document.getElementById('result-text');

    this.bindEvents();
    this.init();
  }

  bindEvents() {
    window.addEventListener('message', (e) => this.handleProtocolMessage(e));

    this.resetBtn.addEventListener('click', () => {
      if (confirm('Reset dungeon run?')) {
        this.resetRun();
      }
    });

    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => {
        if (confirm('Shuffle room order and start a new run?')) {
          this.resetRun();
        }
      });
    }

    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => this.resetRun());
    }

    if (this.prevNavBtn) {
      this.prevNavBtn.addEventListener('click', () => this.goToRoom(this.viewIndex - 1));
    }
    if (this.nextNavBtn) {
      this.nextNavBtn.addEventListener('click', () => this.goToRoom(this.viewIndex + 1));
    }
    if (this.stageArrowLeft) {
      this.stageArrowLeft.addEventListener('click', () => this.goToRoom(this.viewIndex - 1));
    }
    if (this.stageArrowRight) {
      this.stageArrowRight.addEventListener('click', () => this.goToRoom(this.viewIndex + 1));
    }

    // Keyboard arrow navigation
    window.addEventListener('keydown', (e) => {
      if (this.currentRoom && this.isGameRunning) return;
      if (e.key === 'ArrowLeft') {
        this.goToRoom(this.viewIndex - 1);
      } else if (e.key === 'ArrowRight') {
        this.goToRoom(this.viewIndex + 1);
      }
    });

    // Touch & mouse drag support on track viewport
    let startX = 0;
    let isDragging = false;
    if (this.trackViewport) {
      this.trackViewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
      });
      window.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        const diff = e.clientX - startX;
        if (diff > 60) this.goToRoom(this.viewIndex - 1);
        else if (diff < -60) this.goToRoom(this.viewIndex + 1);
      });

      this.trackViewport.addEventListener('touchstart', (e) => {
        if (e.touches.length > 0) startX = e.touches[0].clientX;
      }, { passive: true });
      this.trackViewport.addEventListener('touchend', (e) => {
        if (e.changedTouches.length > 0) {
          const diff = e.changedTouches[0].clientX - startX;
          if (diff > 50) this.goToRoom(this.viewIndex - 1);
          else if (diff < -50) this.goToRoom(this.viewIndex + 1);
        }
      }, { passive: true });

      // Wheel / Trackpad scroll throttle
      let wheelThrottle = 0;
      this.trackViewport.addEventListener('wheel', (e) => {
        if (Math.abs(e.deltaX) > 25 || Math.abs(e.deltaY) > 25) {
          const now = Date.now();
          if (now - wheelThrottle > 320) {
            wheelThrottle = now;
            const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
            if (delta > 0) this.goToRoom(this.viewIndex + 1);
            else this.goToRoom(this.viewIndex - 1);
          }
        }
      }, { passive: true });
    }

    // Window resize recalibration
    window.addEventListener('resize', () => {
      this.updateTrackPosition(false);
    });

    this.startBtn.addEventListener('click', () => this.startCurrentRoom());

    this.exitBtn.addEventListener('click', () => {
      if (this.isGameRunning) {
        if (confirm('Exit sector? It will be marked as FAILED.')) {
          this.handleRoomCompletion(false, 'Exited by player.');
        }
      } else {
        this.closeOverlay();
      }
    });
  }

  async init() {
    await this.loadRooms();
    this.loadSavedState();
    this.viewIndex = Math.min(this.currentIndex, Math.max(0, this.rooms.length - 1));
    this.renderList();
    setTimeout(() => this.updateTrackPosition(false), 50);
  }

  async loadRooms() {
    let assembled = [];
    try {
      const res = await fetch('rooms.json', { cache: 'no-cache' });
      if (res.ok) {
        assembled = await res.json();
      }
    } catch {}

    const isAssembledManifest = Array.isArray(assembled) &&
      assembled.length > 0 &&
      assembled.some(r => r.path && r.path.startsWith('rooms/'));

    if (isAssembledManifest) {
      this.rooms = assembled;
    } else {
      // Local dev mode: Auto-discover room-1 through room-5 if they exist
      const discoveredRooms = [];
      const candidates = ['room-1', 'room-2', 'room-3', 'room-4', 'room-5'];

      await Promise.all(candidates.map(async (cand) => {
        try {
          const metaRes = await fetch(`${cand}/dist/room.json`, { cache: 'no-cache' });
          if (metaRes.ok) {
            const meta = await metaRes.json();
            discoveredRooms.push({
              cand,
              id: cand,
              title: meta.title || cand,
              author: meta.author || 'Participant',
              color: meta.color || '#00f0ff',
              description: meta.description || '',
              path: `${cand}/dist/index.html`
            });
            return;
          }
          const indexRes = await fetch(`${cand}/dist/index.html`, { cache: 'no-cache', method: 'HEAD' });
          if (indexRes.ok) {
            discoveredRooms.push({
              cand,
              id: cand,
              title: cand,
              author: 'Participant',
              color: '#00f0ff',
              description: '',
              path: `${cand}/dist/index.html`
            });
          }
        } catch {}
      }));

      discoveredRooms.sort((a, b) => candidates.indexOf(a.cand) - candidates.indexOf(b.cand));

      if (discoveredRooms.length > 0) {
        this.rooms = discoveredRooms;
      } else if (Array.isArray(assembled) && assembled.length > 0) {
        this.rooms = assembled;
      } else {
        this.rooms = [
          {
            id: 'starter-room',
            title: 'Sector 07: Memory Matrix',
            author: 'Ada Lovelace',
            color: '#e11d48',
            path: 'room-1/dist/index.html'
          }
        ];
      }
    }

    // Refresh live metadata from room.json
    await Promise.all(this.rooms.map(async (room) => {
      try {
        const metadataUrl = room.path.replace(/index\.html$/, 'room.json');
        const metaRes = await fetch(metadataUrl, { cache: 'no-cache' });
        if (metaRes.ok) {
          const meta = await metaRes.json();
          if (meta.title) room.title = meta.title;
          if (meta.author) room.author = meta.author;
          if (meta.color) room.color = meta.color;
          if (meta.description) room.description = meta.description;
        }
      } catch {}
    }));
  }

  loadSavedState() {
    let savedRun = null;
    let savedOrder = null;
    try {
      const runStr = localStorage.getItem('defrag_dungeon_run');
      if (runStr) savedRun = JSON.parse(runStr);
      const orderStr = localStorage.getItem('defrag_dungeon_room_order');
      if (orderStr) savedOrder = JSON.parse(orderStr);
    } catch {
      savedRun = null;
      savedOrder = null;
    }

    const hasActiveRun = savedRun && Object.keys(savedRun).length > 0;

    if (hasActiveRun && savedOrder) {
      this.roomStates = savedRun;
      this.applySavedOrder(savedOrder);
    } else {
      // New play: randomize order!
      this.roomStates = {};
      this.shuffleRooms();
      this.saveState();
    }

    let firstReady = -1;
    for (let i = 0; i < this.rooms.length; i++) {
      const rId = this.rooms[i].id;
      const state = this.roomStates[rId]?.state;
      if (!state || (state !== 'cleared' && state !== 'failed')) {
        firstReady = i;
        break;
      }
    }

    this.currentIndex = firstReady === -1 ? this.rooms.length : firstReady;
  }

  shuffleRooms() {
    for (let i = this.rooms.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.rooms[i], this.rooms[j]] = [this.rooms[j], this.rooms[i]];
    }
  }

  applySavedOrder(orderIds) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return;
    const roomMap = new Map(this.rooms.map(r => [r.id, r]));
    const ordered = [];
    for (const id of orderIds) {
      if (roomMap.has(id)) {
        ordered.push(roomMap.get(id));
        roomMap.delete(id);
      }
    }
    for (const r of roomMap.values()) {
      ordered.push(r);
    }
    this.rooms = ordered;
  }

  saveState() {
    try {
      localStorage.setItem('defrag_dungeon_run', JSON.stringify(this.roomStates));
      localStorage.setItem('defrag_dungeon_room_order', JSON.stringify(this.rooms.map(r => r.id)));
    } catch {}
  }

  resetRun() {
    this.roomStates = {};
    this.currentIndex = 0;
    this.viewIndex = 0;
    this.shuffleRooms();
    this.saveState();
    this.renderList();
    if (this.dungeonSummary) {
      this.dungeonSummary.classList.remove('active');
    }
    this.goToRoom(0, true);
  }

  goToRoom(targetIndex, smooth = true) {
    if (this.rooms.length === 0) return;
    this.viewIndex = Math.max(0, Math.min(this.rooms.length - 1, targetIndex));
    this.updateTrackPosition(smooth);
  }

  updateTrackPosition(smooth = true) {
    if (!this.roomListEl) return;
    const cardNodes = this.roomListEl.querySelectorAll('.room-card-node');
    if (!cardNodes.length) return;

    const viewportWidth = window.innerWidth;
    const targetNode = cardNodes[this.viewIndex];
    if (!targetNode) return;

    const cardEl = targetNode.querySelector('.room-card');
    const nodeLeft = targetNode.offsetLeft;
    const cardWidth = cardEl ? cardEl.offsetWidth : 520;
    const targetCenter = nodeLeft + cardWidth / 2;

    const translateX = (viewportWidth / 2) - targetCenter;

    if (!smooth) {
      this.roomListEl.style.transition = 'none';
      this.roomListEl.style.transform = `translateX(${translateX}px)`;
      requestAnimationFrame(() => {
        this.roomListEl.style.transition = '';
      });
    } else {
      this.roomListEl.style.transform = `translateX(${translateX}px)`;
    }

    // Toggle active state on all cards
    cardNodes.forEach((node, idx) => {
      const c = node.querySelector('.room-card');
      if (c) {
        c.classList.toggle('is-active', idx === this.viewIndex);
      }
    });

    this.updateDots();
    this.updateArrows();
    this.updateProgressIndicator();
  }

  updateArrows() {
    if (this.stageArrowLeft) {
      this.stageArrowLeft.disabled = this.viewIndex <= 0;
    }
    if (this.stageArrowRight) {
      this.stageArrowRight.disabled = this.viewIndex >= this.rooms.length - 1;
    }
    if (this.prevNavBtn) {
      this.prevNavBtn.disabled = this.viewIndex <= 0;
    }
    if (this.nextNavBtn) {
      this.nextNavBtn.disabled = this.viewIndex >= this.rooms.length - 1;
    }
  }

  updateDots() {
    if (!this.trackDotsEl) return;
    const dots = this.trackDotsEl.querySelectorAll('.track-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === this.viewIndex);
    });
  }

  updateProgressIndicator() {
    if (!this.progressIndicator) return;
    const total = this.rooms.length;
    const viewingNum = this.viewIndex + 1;
    this.progressIndicator.textContent = `Sector ${viewingNum} of ${total}`;
  }

  renderList() {
    this.roomListEl.innerHTML = '';
    const total = this.rooms.length;

    this.rooms.forEach((room, idx) => {
      const saved = this.roomStates[room.id] || {};
      let state = 'locked';

      if (saved.state === 'cleared') {
        state = 'cleared';
      } else if (saved.state === 'failed') {
        state = 'failed';
      } else if (idx === this.currentIndex) {
        state = 'ready';
      }

      // Card Node Container
      const nodeWrapper = document.createElement('div');
      nodeWrapper.className = 'room-card-node';

      // Card Element
      const card = document.createElement('div');
      card.className = `room-card state-${state} ${idx === this.viewIndex ? 'is-active' : ''}`;
      const roomColor = room.color || '#00f0ff';
      card.style.setProperty('--room-color', roomColor);
      card.style.setProperty('--room-glow', `${roomColor}66`);

      // 1. Hero Banner with Room Color & Chip
      const heroBanner = document.createElement('div');
      heroBanner.className = 'card-hero-banner';

      const sectorTag = document.createElement('span');
      sectorTag.className = 'sector-tag';
      sectorTag.textContent = `SECTOR ${String(idx + 1).padStart(2, '0')}`;

      const colorChip = document.createElement('div');
      colorChip.className = 'room-color-chip';
      colorChip.style.backgroundColor = roomColor;

      heroBanner.appendChild(sectorTag);
      heroBanner.appendChild(colorChip);
      card.appendChild(heroBanner);

      // 2. Card Content Area
      const contentArea = document.createElement('div');
      contentArea.className = 'card-content-area';

      const titleRow = document.createElement('div');
      titleRow.className = 'title-author-row';

      const titleEl = document.createElement('h2');
      titleEl.className = 'room-title';
      titleEl.textContent = room.title;

      const authorEl = document.createElement('div');
      authorEl.className = 'room-author';
      authorEl.textContent = `BY ${room.author.toUpperCase()}`;

      titleRow.appendChild(titleEl);
      titleRow.appendChild(authorEl);
      contentArea.appendChild(titleRow);

      // Description
      const descEl = document.createElement('p');
      descEl.className = 'room-desc';
      descEl.textContent = room.description || 'Defragment and restore this system node before the countdown expires.';
      contentArea.appendChild(descEl);

      // Status Row
      const statusRow = document.createElement('div');
      statusRow.className = 'status-row';

      const statusBadge = document.createElement('div');
      statusBadge.className = 'room-status-badge';
      if (state === 'cleared') statusBadge.textContent = '✔ CLEARED';
      else if (state === 'failed') statusBadge.textContent = '✖ FAILED';
      else if (state === 'ready') statusBadge.textContent = '▶ READY';
      else statusBadge.textContent = '🔒 LOCKED';
      statusRow.appendChild(statusBadge);

      if (saved.result) {
        const resultBadge = document.createElement('div');
        resultBadge.className = 'room-result-badge';
        resultBadge.textContent = saved.result;
        statusRow.appendChild(resultBadge);
      }
      contentArea.appendChild(statusRow);

      // Action Button
      const actionBar = document.createElement('div');
      actionBar.className = 'card-action-bar';

      const actionBtn = document.createElement('button');
      if (state === 'ready') {
        actionBtn.className = 'play-action-btn';
        actionBtn.innerHTML = '<span>ENTER SECTOR</span> <span>⚡</span>';
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.enterRoom(room, idx);
        });
      } else if (state === 'cleared' || state === 'failed') {
        actionBtn.className = 'replay-action-btn';
        actionBtn.innerHTML = '<span>REPLAY SECTOR</span> <span>↺</span>';
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.enterRoom(room, idx);
        });
      } else {
        actionBtn.className = 'locked-action-btn';
        actionBtn.disabled = true;
        actionBtn.innerHTML = '<span>SECTOR LOCKED</span> <span>🔒</span>';
      }

      actionBar.appendChild(actionBtn);
      contentArea.appendChild(actionBar);
      card.appendChild(contentArea);

      // Clicking a card focuses it on stage
      card.addEventListener('click', () => {
        if (this.viewIndex !== idx) {
          this.goToRoom(idx, true);
        }
      });

      nodeWrapper.appendChild(card);

      // 3. Connecting Conduit Line between this card and the next
      if (idx < total - 1) {
        const nextRoom = this.rooms[idx + 1];
        const nextColor = nextRoom.color || '#00f0ff';

        const conduit = document.createElement('div');
        conduit.className = 'room-conduit';

        const conduitLine = document.createElement('div');
        conduitLine.className = `conduit-line ${state === 'cleared' ? 'active' : (state === 'ready' ? 'pulse' : 'inactive')}`;
        conduitLine.style.setProperty('--from-color', roomColor);
        conduitLine.style.setProperty('--to-color', nextColor);

        conduit.appendChild(conduitLine);
        nodeWrapper.appendChild(conduit);
      }

      this.roomListEl.appendChild(nodeWrapper);
    });

    // Render Navigation Dots at Bottom
    this.renderDots();

    // Check completion
    if (this.currentIndex >= this.rooms.length && this.rooms.length > 0) {
      let cleared = 0;
      let failed = 0;
      this.rooms.forEach(r => {
        const st = this.roomStates[r.id]?.state;
        if (st === 'cleared') cleared++;
        if (st === 'failed') failed++;
      });
      this.summaryText.textContent = `SYSTEM DIAGNOSTIC: ${cleared} Restored | ${failed} Corrupted`;
      this.dungeonSummary.classList.add('active');
    }

    this.updateTrackPosition(false);
  }

  renderDots() {
    if (!this.trackDotsEl) return;
    this.trackDotsEl.innerHTML = '';
    this.rooms.forEach((room, idx) => {
      const dot = document.createElement('div');
      dot.className = `track-dot ${idx === this.viewIndex ? 'active' : ''}`;
      const saved = this.roomStates[room.id] || {};
      if (saved.state === 'cleared') dot.classList.add('cleared');
      else if (saved.state === 'failed') dot.classList.add('failed');

      dot.title = `Sector ${idx + 1}: ${room.title}`;
      dot.addEventListener('click', () => {
        this.goToRoom(idx, true);
      });
      this.trackDotsEl.appendChild(dot);
    });
  }

  enterRoom(room, idx) {
    this.currentRoom = room;
    this.currentRoomIndex = idx;
    this.isGameRunning = false;

    // Set Header Info
    const color = room.color || '#00f0ff';
    this.overlayColor.style.backgroundColor = color;
    this.overlayColor.style.boxShadow = `0 0 10px ${color}`;
    this.overlayTitle.textContent = `${room.title} (by ${room.author})`;
    this.overlayTimer.textContent = '100.0s';
    this.overlayTimer.className = 'overlay-timer';
    this.graceIndicator.classList.remove('active');
    this.resultBanner.classList.remove('active');

    // Reset Start Button
    this.startBtn.disabled = false;
    this.startBtn.textContent = 'Start Room';

    // Mount Iframe at 0.2 opacity and unclickable
    this.roomIframe.classList.remove('started');
    this.roomIframe.src = room.path;

    // Show Overlay
    this.overlay.classList.add('active');
  }

  startCurrentRoom() {
    if (this.isGameRunning) return;
    this.isGameRunning = true;

    // Activate Iframe: full opacity, clickable
    this.roomIframe.classList.add('started');

    // Update Start Button
    this.startBtn.disabled = true;
    this.startBtn.textContent = 'Running...';

    // Send defrag:start signal to the room iframe
    try {
      this.roomIframe.contentWindow.postMessage({ type: 'defrag:start' }, '*');
    } catch (e) {
      console.warn('Could not post start signal', e);
    }

    // Begin 100-second timer
    this.startCountdown();
  }

  startCountdown() {
    this.stopTimers();
    this.timerStartTime = Date.now();

    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStartTime;
      const remaining = Math.max(0, this.TIMER_LIMIT_MS - elapsed);
      const remainingSec = (remaining / 1000).toFixed(1);

      this.overlayTimer.textContent = `${remainingSec}s`;

      if (remaining <= 15000) {
        this.overlayTimer.className = 'overlay-timer warning';
      }

      if (remaining <= 0) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.triggerTimeout();
      }
    }, 50);
  }

  triggerTimeout() {
    try {
      this.roomIframe.contentWindow.postMessage({
        type: 'defrag:timeout',
        gracePeriodMs: this.GRACE_LIMIT_MS
      }, '*');
    } catch {}

    this.graceIndicator.classList.add('active');

    const graceStart = Date.now();
    this.graceInterval = setInterval(() => {
      const elapsed = Date.now() - graceStart;
      const remainingGrace = Math.max(0, this.GRACE_LIMIT_MS - elapsed);
      const graceSec = (remainingGrace / 1000).toFixed(1);

      this.graceIndicator.textContent = `Grace: ${graceSec}s`;

      if (remainingGrace <= 0) {
        clearInterval(this.graceInterval);
        this.graceInterval = null;
        this.handleRoomCompletion(false, 'Sector timed out. Grace period expired.');
      }
    }, 50);
  }

  handleProtocolMessage(event) {
    if (!this.currentRoom || !this.isGameRunning) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'defrag:complete' || data.type === 'room:complete') {
      const success = Boolean(data.success);
      const result = typeof data.result === 'string' ? data.result : (success ? 'Sector cleared' : 'Sector failed');
      this.handleRoomCompletion(success, result);
    }
  }

  handleRoomCompletion(success, result) {
    this.stopTimers();
    this.isGameRunning = false;

    const room = this.currentRoom;
    const roomIndex = this.currentRoomIndex;

    // Show result banner
    this.resultTitle.textContent = success ? 'SECTOR RESTORED' : 'SECTOR CORRUPTED';
    this.resultTitle.style.color = success ? 'var(--neon-emerald)' : 'var(--neon-rose)';
    this.resultBanner.style.borderColor = success ? 'var(--neon-emerald)' : 'var(--neon-rose)';
    this.resultText.textContent = result;
    this.resultBanner.classList.add('active');

    // Record state
    this.roomStates[room.id] = {
      state: success ? 'cleared' : 'failed',
      result: result
    };

    if (roomIndex === this.currentIndex) {
      this.currentIndex = roomIndex + 1;
    }

    this.saveState();

    // After 1.4s, close overlay, refresh list, and smoothly animate carousel to next room!
    setTimeout(() => {
      this.closeOverlay();
      this.renderList();
      const nextTarget = Math.min(this.currentIndex, this.rooms.length - 1);
      this.goToRoom(nextTarget, true);
    }, 1400);
  }

  closeOverlay() {
    this.stopTimers();
    this.isGameRunning = false;
    try {
      this.roomIframe.src = 'about:blank';
    } catch {}
    this.roomIframe.classList.remove('started');
    this.overlay.classList.remove('active');
    this.resultBanner.classList.remove('active');
    this.graceIndicator.classList.remove('active');
    this.currentRoom = null;
  }

  stopTimers() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.graceInterval) {
      clearInterval(this.graceInterval);
      this.graceInterval = null;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.overworld = new BarebonesOverworld();
});
