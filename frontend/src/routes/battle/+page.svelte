<script>
  import { onMount, onDestroy } from 'svelte';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';

  /** @type {'waiting' | 'matched'} */
  let state = 'waiting';
  let topic = '';
  let prompt = '';
  let socket;

  onMount(() => {
    socket = io();
    socket.emit('join_queue');
    socket.on('match_found', (data) => {
      topic = data.topic;
      state = 'matched';
    });
  });

  onDestroy(() => {
    socket?.disconnect();
  });
</script>

<div class="page">
  {#if state === 'waiting'}
    <div class="waiting">
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

  {:else if state === 'matched'}
    <div class="battle" in:fade>
      <p class="found-badge">⚔ Opponent found!</p>
      <h2 class="topic-label">Describe</h2>
      <p class="topic">{topic}</p>
      <textarea
        class="prompt-input"
        placeholder="Write your image prompt here…"
        maxlength="400"
        bind:value={prompt}
        autofocus
      ></textarea>
      <div class="char-count">{prompt.length} / 400</div>
      <button class="submit-btn" disabled={prompt.trim().length === 0}>
        Submit Prompt
      </button>
    </div>
  {/if}
</div>

<script context="module">
  import { fade } from 'svelte/transition';
</script>

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

  /* ── Matched ── */
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
    font-size: clamp(1.6rem, 4vw, 2.4rem);
    font-weight: 800;
    color: var(--text-primary);
    line-height: 1.2;
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
</style>
