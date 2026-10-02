// Barebones Defrag Dungeon Overworld Host

class BarebonesOverworld {
  constructor() {
    this.rooms = [];
    this.currentIndex = 0;
    this.currentRoom = null;
    this.roomStates = {}; // roomId -> { state: 'locked'|'ready'|'cleared'|'failed', result: '' }

    this.TIMER_LIMIT_MS = 100000; // 100 seconds
    this.GRACE_LIMIT_MS = 5000;   // 5 seconds grace period
    this.timerStartTime = 0;
    this.timerInterval = null;
    this.graceInterval = null;
    this.isGameRunning = false;

    // DOM Elements
    this.roomListEl = document.getElementById('room-list');
    this.progressIndicator = document.getElementById('progress-indicator');
    this.resetBtn = document.getElementById('reset-btn');
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

    if (this.replayBtn) {
      this.replayBtn.addEventListener('click', () => this.resetRun());
    }

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
    this.renderList();
  }

  async loadRooms() {
    let assembled = [];
    try {
      const res = await fetch('rooms.json', { cache: 'no-cache' });
      if (res.ok) {
        assembled = await res.json();
      }
    } catch {}

    // Check if rooms.json has assembled rooms from workshop assembler
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
              color: meta.color || '#3b82f6',
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
              color: '#3b82f6',
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
    try {
      const saved = localStorage.getItem('defrag_dungeon_run');
      if (saved) {
        this.roomStates = JSON.parse(saved);
      }
    } catch {
      this.roomStates = {};
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

  saveState() {
    try {
      localStorage.setItem('defrag_dungeon_run', JSON.stringify(this.roomStates));
    } catch {}
  }

  resetRun() {
    this.roomStates = {};
    this.currentIndex = 0;
    this.saveState();
    this.renderList();
    if (this.dungeonSummary) {
      this.dungeonSummary.classList.remove('active');
    }
  }

  renderList() {
    this.roomListEl.innerHTML = '';
    const total = this.rooms.length;
    const currentNum = Math.min(this.currentIndex + 1, total);
    this.progressIndicator.textContent = `Room ${currentNum} of ${total}`;

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

      const card = document.createElement('div');
      card.className = `room-card state-${state}`;

      // Color Box from room.json
      const colorBox = document.createElement('div');
      colorBox.className = 'room-color-box';
      colorBox.style.backgroundColor = room.color || '#3b82f6';
      card.appendChild(colorBox);

      // Room Info
      const info = document.createElement('div');
      info.className = 'room-info';

      const headerLine = document.createElement('div');
      headerLine.className = 'room-header-line';

      const titleEl = document.createElement('span');
      titleEl.className = 'room-title';
      titleEl.textContent = `${idx + 1}. ${room.title}`;

      const authorEl = document.createElement('span');
      authorEl.className = 'room-author';
      authorEl.textContent = `by ${room.author}`;

      headerLine.appendChild(titleEl);
      headerLine.appendChild(authorEl);
      info.appendChild(headerLine);

      const statusEl = document.createElement('div');
      statusEl.className = 'room-status';
      if (state === 'cleared') statusEl.textContent = '[CLEARED]';
      else if (state === 'failed') statusEl.textContent = '[FAILED]';
      else if (state === 'ready') statusEl.textContent = '[READY]';
      else statusEl.textContent = '[LOCKED]';
      info.appendChild(statusEl);

      if (saved.result) {
        const resultEl = document.createElement('div');
        resultEl.className = 'room-result';
        resultEl.textContent = `Result: ${saved.result}`;
        info.appendChild(resultEl);
      }

      card.appendChild(info);

      // Action Button
      if (state === 'ready' || state === 'cleared' || state === 'failed') {
        const actionCol = document.createElement('div');
        actionCol.className = 'room-actions';

        const btn = document.createElement('button');
        btn.className = 'enter-btn';
        btn.textContent = state === 'ready' ? 'Enter Room' : 'Replay';

        btn.addEventListener('click', () => {
          this.enterRoom(room, idx);
        });

        actionCol.appendChild(btn);
        card.appendChild(actionCol);
      }

      this.roomListEl.appendChild(card);
    });

    // Check complete
    if (this.currentIndex >= this.rooms.length && this.rooms.length > 0) {
      let cleared = 0;
      let failed = 0;
      this.rooms.forEach(r => {
        const st = this.roomStates[r.id]?.state;
        if (st === 'cleared') cleared++;
        if (st === 'failed') failed++;
      });
      this.summaryText.textContent = `Cleared: ${cleared} | Failed: ${failed}`;
      this.dungeonSummary.classList.add('active');
    }
  }

  enterRoom(room, idx) {
    this.currentRoom = room;
    this.currentRoomIndex = idx;
    this.isGameRunning = false;

    // Set Header Info
    this.overlayColor.style.backgroundColor = room.color || '#3b82f6';
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
    // Send defrag:timeout to iframe
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
        this.handleRoomCompletion(false, 'Room timed out. Grace period expired.');
      }
    }, 50);
  }

  handleProtocolMessage(event) {
    if (!this.currentRoom || !this.isGameRunning) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'defrag:complete' || data.type === 'room:complete') {
      const success = Boolean(data.success);
      const result = typeof data.result === 'string' ? data.result : (success ? 'Room cleared' : 'Room failed');
      this.handleRoomCompletion(success, result);
    }
  }

  handleRoomCompletion(success, result) {
    this.stopTimers();
    this.isGameRunning = false;

    const room = this.currentRoom;
    const roomIndex = this.currentRoomIndex;

    // Show result banner
    this.resultTitle.textContent = success ? 'ROOM CLEARED' : 'ROOM FAILED';
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

    // After 1.5s, close overlay and refresh list
    setTimeout(() => {
      this.closeOverlay();
      this.renderList();
    }, 1500);
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
