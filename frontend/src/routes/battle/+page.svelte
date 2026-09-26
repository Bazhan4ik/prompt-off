<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';
  import { battleStore } from '$lib/battleStore';
  import { BACKEND_URL } from '$lib/backend';

  type State = 'naming' | 'waiting' | 'loading_challenge' | 'writing' | 'submitted';

  const TIME_LIMIT = 15;

  let state: State = 'naming';
  let playerName = '';
  let roomId = '';
  let opponentName = '';
  let referenceImage: { base64: string; mimeType: string } | null = null;
  let guess = '';
  let errorMsg = '';
  let socket: ReturnType<typeof io>;

  let timeLeft = TIME_LIMIT;
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  // SVG ring math
  const RADIUS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  $: ringOffset = CIRCUMFERENCE * (1 - timeLeft / TIME_LIMIT);
  $: timerColor = timeLeft > 7 ? '#22c55e' : timeLeft > 3 ? '#f5c842' : '#ef4444';
  $: timerUrgent = timeLeft <= 3;

  function startTimer() {
    timeLeft = TIME_LIMIT;
    timerInterval = setInterval(() => {
      timeLeft -= 1;
      if (timeLeft <= 0) {
        stopTimer();
        submitGuess();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval !== null) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  let pendingBattle: { topic: string; players: string[]; playerNames: Record<string, string>; guesses: Record<string, string>; referenceImage: { base64: string; mimeType: string } } | null = null;

  function joinQueue() {
    const name = playerName.trim();
    if (!name) return;
    state = 'waiting';

    socket = io(BACKEND_URL);
    socket.emit('join_queue', { name });

    socket.on('match_found', (data: { roomId: string; opponentName: string }) => {
      roomId = data.roomId;
      opponentName = data.opponentName;
      state = 'loading_challenge';
    });

    socket.on('reference_ready', (data: { referenceImage: { base64: string; mimeType: string } }) => {
      referenceImage = data.referenceImage;
      state = 'writing';
      startTimer();
    });

    socket.on('reference_error', (data: { message: string }) => {
      errorMsg = data.message;
    });

    socket.on('guess_submitted', () => {
      state = 'submitted';
    });

    socket.on('both_ready', (data: typeof pendingBattle) => {
      pendingBattle = data;
    });

    socket.on('judgment_result', () => {
      if (!pendingBattle) return;
      const myIndex = pendingBattle.players.indexOf(socket.id);
      const opponentId = pendingBattle.players[myIndex === 0 ? 1 : 0];
      battleStore.set({
        roomId,
        originalTopic: pendingBattle.topic,
        playerNumber: (myIndex + 1) as 1 | 2,
        referenceImage: pendingBattle.referenceImage!,
        myGuess: pendingBattle.guesses[socket.id],
        opponentGuess: pendingBattle.guesses[opponentId],
        myName: pendingBattle.playerNames[socket.id],
        opponentName: pendingBattle.playerNames[opponentId],
      });
      goto('/judging');
    });

    socket.on('generation_error', (data: { message: string }) => {
      errorMsg = data.message;
      state = 'writing';
    });

    socket.on('opponent_disconnected', () => {
      errorMsg = 'Your opponent disconnected.';
    });
  }

  onMount(() => {
    // nothing — socket is created on name submit
  });

  onDestroy(() => {
    stopTimer();
    socket?.disconnect();
  });

  function submitGuess() {
    if (!roomId) return;
    stopTimer();
    const finalGuess = guess.trim() || '(no guess)';
    socket.emit('submit_guess', { roomId, guess: finalGuess });
  }
</script>

<div class="page">

  <!-- ── Enter name ── -->
  {#if state === 'naming'}
    <div class="center-stack" in:fade={{ duration: 200 }}>
      <p class="found-badge">⚔ Clash of Slops</p>
      <h2 class="big-label">Enter Your Name</h2>
      <p class="sub">Your opponent will see this</p>
      <input
        class="name-input"
        type="text"
        placeholder="Battle name…"
        maxlength="32"
        bind:value={playerName}
        autofocus
        on:keydown={(e) => e.key === 'Enter' && playerName.trim() && joinQueue()}
      />
      <button
        class="submit-btn"
        disabled={playerName.trim().length === 0}
        on:click={joinQueue}
      >
        Find Opponent →
      </button>
      <button class="ghost-btn" on:click={() => goto('/')}>Cancel</button>
    </div>

  <!-- ── Waiting for match ── -->
  {:else if state === 'waiting'}
    <div class="center-stack" in:fade={{ duration: 200 }}>
      <div class="radar">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
        <div class="pulse"></div>
      </div>
      <h2 class="big-label">Finding your opponent…</h2>
      <p class="sub">Playing as <strong>{playerName}</strong></p>
      <button class="ghost-btn" on:click={() => goto('/')}>Cancel</button>
    </div>

  <!-- ── Opponent found, generating reference image ── -->
  {:else if state === 'loading_challenge'}
    <div class="center-stack" in:fade={{ duration: 250 }}>
      <div class="gen-spinner">
        <div class="spinner-ring"></div>
        <span class="spinner-icon">✦</span>
      </div>
      <h2 class="big-label">Opponent found!</h2>
      <p class="sub">You're up against <strong class="opp-highlight">{opponentName}</strong></p>
      <p class="sub">Generating your challenge image…</p>

      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}
    </div>

  <!-- ── Write your guess ── -->
  {:else if state === 'writing'}
    <div class="writing-layout" in:fade={{ duration: 300 }}>
      <p class="found-badge">⚔ vs <span class="opp-highlight">{opponentName}</span></p>

      {#if referenceImage}
        <div class="ref-image-wrap">
          <img
            src="data:{referenceImage.mimeType};base64,{referenceImage.base64}"
            alt="Challenge image"
            class="ref-image"
          />
        </div>
      {/if}

      <div class="timer-row">
        <svg class="timer-ring" viewBox="0 0 48 48" width="48" height="48">
          <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="#182418" stroke-width="4" />
          <circle
            cx="24" cy="24" r={RADIUS}
            fill="none"
            stroke={timerColor}
            stroke-width="4"
            stroke-linecap="round"
            stroke-dasharray={CIRCUMFERENCE}
            stroke-dashoffset={ringOffset}
            transform="rotate(-90 24 24)"
            style="transition: stroke-dashoffset 0.9s linear, stroke 0.3s"
          />
          <text
            x="24" y="24"
            text-anchor="middle"
            dominant-baseline="central"
            fill={timerColor}
            font-size="13"
            font-weight="700"
            class:urgent={timerUrgent}
          >{timeLeft}</text>
        </svg>
        <p class="guess-instruction">Write the prompt you think generated this image</p>
      </div>

      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}

      <textarea
        class="prompt-input"
        placeholder="Describe what you think the original prompt was…"
        maxlength="400"
        bind:value={guess}
        autofocus
      ></textarea>
      <div class="char-count">{guess.length} / 400</div>

      <button
        class="submit-btn"
        disabled={guess.trim().length === 0 || timeLeft <= 0}
        on:click={submitGuess}
      >
        Submit Guess
      </button>
    </div>

  <!-- ── Guess submitted, waiting for opponent ── -->
  {:else if state === 'submitted'}
    <div class="center-stack" in:fade={{ duration: 200 }}>
      {#if referenceImage}
        <div class="ref-image-wrap ref-image-small">
          <img
            src="data:{referenceImage.mimeType};base64,{referenceImage.base64}"
            alt="Challenge image"
            class="ref-image"
          />
        </div>
      {/if}
      <div class="your-guess-label">Your guess</div>
      <p class="your-guess-text">"{guess}"</p>
      <div class="waiting-opponent">
        <div class="mini-pulse"></div>
        <span>Waiting for <strong>{opponentName}</strong>'s guess…</span>
      </div>
      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}
    </div>
  {/if}

</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  /* ── Shared centered stack ── */
  .center-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    text-align: center;
    max-width: 520px;
    width: 100%;
  }

  .big-label {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .sub {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin-top: -0.5rem;
  }

  .opp-highlight {
    color: var(--accent-glow);
  }

  /* ── Name input ── */
  .name-input {
    width: 100%;
    padding: 0.9rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-border);
    border-radius: 14px;
    color: var(--text-primary);
    font-size: 1.1rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
    text-align: center;
  }
  .name-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
  .name-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #4d8f0025;
  }

  /* ── Radar ── */
  .radar {
    position: relative;
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring {
    position: absolute;
    border-radius: 50%;
    border: 2px solid var(--accent-glow);
    animation: expand 2.4s ease-out infinite;
    opacity: 0;
  }
  .ring-1 { animation-delay: 0s; }
  .ring-2 { animation-delay: 0.8s; }
  .ring-3 { animation-delay: 1.6s; }

  @keyframes expand {
    0%   { width: 24px; height: 24px; opacity: 0.8; }
    100% { width: 120px; height: 120px; opacity: 0; }
  }

  .pulse {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--accent-glow);
    box-shadow: 0 0 16px var(--accent-glow);
    animation: throb 1.2s ease-in-out infinite;
  }

  @keyframes throb {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%       { transform: scale(1.2); opacity: 0.7; }
  }

  /* ── Spinner ── */
  .gen-spinner {
    position: relative;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .spinner-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid transparent;
    border-top-color: var(--accent-glow);
    border-right-color: var(--accent-glow);
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .spinner-icon {
    font-size: 1.5rem;
    color: var(--accent-glow);
    animation: throb 2s ease-in-out infinite;
  }

  /* ── Ghost button ── */
  .ghost-btn {
    padding: 0.5rem 1.5rem;
    border-radius: 100px;
    border: 1px solid var(--bg-border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: border-color 0.15s, color 0.15s;
  }
  .ghost-btn:hover {
    border-color: var(--accent-glow);
    color: var(--text-primary);
  }

  /* ── Writing layout ── */
  .writing-layout {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.1rem;
    width: 100%;
    max-width: 600px;
    text-align: center;
  }

  .found-badge {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-glow);
    background: #4d8f0018;
    border: 1px solid #4d8f0040;
    border-radius: 100px;
    padding: 0.35rem 1rem;
  }

  .ref-image-wrap {
    width: 100%;
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid var(--bg-border);
    box-shadow: 0 0 40px #4d8f0020;
  }

  .ref-image-small {
    max-width: 320px;
  }

  .ref-image {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .timer-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
  }

  .timer-ring {
    flex-shrink: 0;
  }

  :global(.urgent) {
    animation: pulse-text 0.5s ease-in-out infinite alternate;
  }

  @keyframes pulse-text {
    from { opacity: 1; }
    to   { opacity: 0.4; }
  }

  .guess-instruction {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .error-msg {
    font-size: 0.85rem;
    color: var(--loss);
    background: #ef444415;
    border: 1px solid #ef444430;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    width: 100%;
  }

  .prompt-input {
    width: 100%;
    min-height: 140px;
    padding: 1rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-border);
    border-radius: 14px;
    color: var(--text-primary);
    font-size: 1rem;
    font-family: inherit;
    line-height: 1.6;
    resize: vertical;
    transition: border-color 0.15s, box-shadow 0.15s;
    outline: none;
  }
  .prompt-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
  .prompt-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #4d8f0025;
  }

  .char-count {
    align-self: flex-end;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: -0.5rem;
  }

  .submit-btn {
    width: 100%;
    padding: 1rem;
    border-radius: 100px;
    border: none;
    background: linear-gradient(135deg, #3a7a00, #6ab000);
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 30px #4d8f0050;
  }
  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 50px #7fc80070;
  }
  .submit-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ── Submitted state ── */
  .your-guess-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-secondary);
  }

  .your-guess-text {
    font-size: 1rem;
    color: var(--text-primary);
    font-style: italic;
    max-width: 420px;
    line-height: 1.5;
  }

  .waiting-opponent {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
  }

  .mini-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-glow);
    animation: throb 1.2s ease-in-out infinite;
  }
</style>
