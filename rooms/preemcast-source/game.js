// Barebones Room Game Logic (Waits for Host Start Signal)

(function () {
  const TOTAL_BLOCKS = 8;
  let hasStarted = false;
  let hasEnded = false;
  let nextTarget = 1;
  let errors = 0;
  let startTime = null;

  const statusBadge = document.getElementById('status-badge');
  const instructionText = document.getElementById('instruction-text');
  const gridEl = document.getElementById('grid');
  const errorsEl = document.getElementById('errors-count');
  const giveUpBtn = document.getElementById('give-up-btn');

  // Protocol sender
  function sendComplete(success, resultText) {
    if (hasEnded) return;
    hasEnded = true;
    window.parent.postMessage({
      type: 'defrag:complete',
      success: Boolean(success),
      result: String(resultText)
    }, '*');
  }

  // Generate shuffled blocks (initially disabled)
  function initGrid() {
    gridEl.innerHTML = '';
    const numbers = Array.from({ length: TOTAL_BLOCKS }, (_, i) => i + 1);
    numbers.sort(() => Math.random() - 0.5);

    numbers.forEach((num) => {
      const btn = document.createElement('button');
      btn.className = 'cell-btn';
      btn.textContent = num;
      btn.disabled = true; // disabled until defrag:start

      btn.addEventListener('click', () => {
        if (!hasStarted || hasEnded) return;

        if (num === nextTarget) {
          btn.classList.add('cleared');
          btn.disabled = true;
          nextTarget++;

          if (nextTarget > TOTAL_BLOCKS) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            statusBadge.textContent = 'RESTORED';
            sendComplete(true, `Restored ${TOTAL_BLOCKS}/${TOTAL_BLOCKS} blocks in ${elapsed}s (Errors: ${errors})`);
          } else {
            instructionText.textContent = `TARGET: Click #${nextTarget}`;
          }
        } else {
          errors++;
          errorsEl.textContent = errors;
        }
      });

      gridEl.appendChild(btn);
    });
  }

  // Start the game when host sends signal
  function onHostStart() {
    if (hasStarted) return;
    hasStarted = true;
    startTime = Date.now();

    statusBadge.textContent = 'ACTIVE';
    instructionText.textContent = `TARGET: Click #1`;

    // Enable all grid buttons
    const buttons = gridEl.querySelectorAll('.cell-btn');
    buttons.forEach((b) => (b.disabled = false));
  }

  // Handle timeout from host (5s grace period)
  function onHostTimeout() {
    statusBadge.textContent = 'TIMEOUT';
    const progress = `${nextTarget - 1}/${TOTAL_BLOCKS}`;
    sendComplete(false, `Time expired (restored ${progress} blocks)`);
  }

  // Listen for host postMessages
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'defrag:start') {
      onHostStart();
    }

    if (event.data.type === 'defrag:timeout') {
      onHostTimeout();
    }
  });

  // Give up button handler
  giveUpBtn.addEventListener('click', () => {
    if (!hasStarted || hasEnded) return;
    sendComplete(false, `Aborted at block ${nextTarget - 1}/${TOTAL_BLOCKS}`);
  });

  initGrid();
})();
