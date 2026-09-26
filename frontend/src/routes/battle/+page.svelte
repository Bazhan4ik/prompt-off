<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';
  import { battleStore } from '$lib/battleStore';

  /** @type {'waiting' | 'matched' | 'submitting' | 'image_ready'} */
  let state = 'waiting';
  let topic = '';
  let roomId = '';
  let prompt = '';
  let imageBase64 = '';
  let imageMime = 'image/jpeg';
  let errorMsg = '';
  let socket;

  onMount(() => {
    socket = io();
    socket.emit('join_queue');

    socket.on('match_found', (data) => {
      topic = data.topic;
      roomId = data.roomId;
      state = 'matched';
    });

    socket.on('generating', () => {
      state = 'submitting';
    });

    socket.on('image_ready', (data) => {
      imageBase64 = data.base64;
      imageMime = data.mimeType ?? 'image/jpeg';
      state = 'image_ready';
    });

    socket.on('both_ready', (data) => {
      const myIndex = data.players.indexOf(socket.id);
      const opponentId = data.players[myIndex === 0 ? 1 : 0];
      battleStore.set({
        roomId: data.roomId,
        topic: data.topic,
        playerNumber: (myIndex + 1) as 1 | 2,
        myImage: data.images[socket.id],
        myPrompt: data.prompts[socket.id],
        opponentImage: data.images[opponentId],
        opponentPrompt: data.prompts[opponentId],
      });
      goto('/judging');
    });

    socket.on('generation_error', (data) => {
      errorMsg = data.message;
      state = 'matched';
    });

    socket.on('opponent_disconnected', () => {
      errorMsg = 'Your opponent disconnected.';
    });
  });

  onDestroy(() => {
    socket?.disconnect();
  });

  function submitPrompt() {
    if (!prompt.trim() || !roomId) return;
    socket.emit('submit_prompt', { roomId, prompt });
  }
</script>

<div class="page">

  <!-- ── Waiting for match ── -->
  {#if state === 'waiting'}
    <div class="waiting" in:fade={{ duration: 200 }}>
      <div class="radar">
        <div class="ring ring-1"></div>
        <div class="ring ring-2"></div>
        <div class="ring ring-3"></div>
        <div class="pulse"></div>
      </div>
      <h2 class="searching-title">Finding your opponent…</h2>
      <p class="searching-sub">Get ready to craft the perfect prompt</p>
      <button class="cancel-btn" on:click={() => goto('/')}>Cancel</button>
    </div>

  <!-- ── Write your prompt ── -->
  {:else if state === 'matched'}
    <div class="battle" in:fade={{ duration: 300 }}>
      <p class="found-badge">⚔ Opponent found!</p>
      <h2 class="topic-label">Describe</h2>
      <p class="topic">{topic}</p>

      {#if errorMsg}
        <p class="error-msg">{errorMsg}</p>
      {/if}

      <textarea
        class="prompt-input"
        placeholder="Write your image prompt here…"
        maxlength="400"
        bind:value={prompt}
        autofocus
      ></textarea>
      <div class="char-count">{prompt.length} / 400</div>

      <button
        class="submit-btn"
        disabled={prompt.trim().length === 0}
        on:click={submitPrompt}
      >
        Submit Prompt
      </button>
    </div>

  <!-- ── Generating image ── -->
  {:else if state === 'submitting'}
    <div class="generating" in:fade={{ duration: 200 }}>
      <div class="gen-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-icon">✦</div>
      </div>
      <h2 class="gen-title">Generating your image…</h2>
      <p class="gen-sub">Gemini is painting your vision</p>
      <p class="gen-prompt">"{prompt}"</p>
    </div>

  <!-- ── Image ready ── -->
  {:else if state === 'image_ready'}
    <div class="result" in:fade={{ duration: 400 }}>
      <p class="found-badge">Your image is ready!</p>
      <p class="topic">{topic}</p>

      <div class="image-wrap">
        <img
          src="data:{imageMime};base64,{imageBase64}"
          alt="Your generated image"
          class="generated-img"
        />
      </div>

      <p class="gen-prompt">"{prompt}"</p>

      <div class="waiting-opponent">
        <div class="mini-pulse"></div>
        <span>Waiting for opponent's image…</span>
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

  /* ── Waiting ── */
  .waiting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
  }

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
    0%, 100% { transform: scale(1);    opacity: 1; }
    50%       { transform: scale(1.2); opacity: 0.7; }
  }

  .searching-title {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .searching-sub {
    font-size: 0.95rem;
    color: var(--text-secondary);
  }

  .cancel-btn {
    margin-top: 0.5rem;
    padding: 0.5rem 1.5rem;
    border-radius: 100px;
    border: 1px solid var(--bg-border);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.85rem;
    transition: border-color 0.15s, color 0.15s;
  }

  .cancel-btn:hover {
    border-color: var(--accent-glow);
    color: var(--text-primary);
  }

  /* ── Matched / prompt input ── */
  .battle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 640px;
    text-align: center;
  }

  .found-badge {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-glow);
    background: #7c3aed18;
    border: 1px solid #7c3aed40;
    border-radius: 100px;
    padding: 0.35rem 1rem;
  }

  .topic-label {
    font-size: 1rem;
    font-weight: 400;
    color: var(--text-secondary);
    margin-bottom: -0.75rem;
  }

  .topic {
    font-size: clamp(1.5rem, 4vw, 2.2rem);
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.2;
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
    min-height: 180px;
    padding: 1.1rem 1.25rem;
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
    margin-top: 0.5rem;
  }

  .prompt-input::placeholder {
    color: var(--text-secondary);
    opacity: 0.6;
  }

  .prompt-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px #7c3aed25;
  }

  .char-count {
    align-self: flex-end;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: -0.75rem;
  }

  .submit-btn {
    width: 100%;
    padding: 1rem;
    border-radius: 100px;
    border: none;
    background: linear-gradient(135deg, #7c3aed, #a21caf);
    color: #fff;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 30px #7c3aed50;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 0 50px #a855f770;
  }

  .submit-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    box-shadow: none;
  }

  /* ── Generating ── */
  .generating {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
    max-width: 480px;
  }

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

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .spinner-icon {
    font-size: 1.5rem;
    color: var(--accent-glow);
    animation: throb 2s ease-in-out infinite;
  }

  .gen-title {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .gen-sub {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin-top: -0.75rem;
  }

  .gen-prompt {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-style: italic;
    max-width: 400px;
    line-height: 1.5;
  }

  /* ── Image result ── */
  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 100%;
    max-width: 560px;
    text-align: center;
  }

  .image-wrap {
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--bg-border);
    box-shadow: 0 0 40px #7c3aed30;
  }

  .generated-img {
    width: 100%;
    display: block;
    object-fit: cover;
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
