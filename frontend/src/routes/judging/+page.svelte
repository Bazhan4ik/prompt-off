<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';
  import { battleStore } from '$lib/battleStore';
  import { BACKEND_URL } from '$lib/backend';
  import { get } from 'svelte/store';

  let battle = get(battleStore);

  type JudgeState = 'judging' | 'done' | 'error' | 'missing';
  let judgeState: JudgeState = battle ? 'judging' : 'missing';

  let judgment: { winner: 1 | 2; reason: string; originalTopic: string } | null = null;
  let errorMsg = '';
  let socket: ReturnType<typeof io>;

  $: iWon = judgment && battle && judgment.winner === battle.playerNumber;

  onMount(() => {
    if (!battle) return;

    socket = io(BACKEND_URL);
    socket.emit('join_judging', { roomId: battle.roomId });

    socket.on('judgment_result', (data) => {
      judgment = data;
      judgeState = 'done';
    });

    socket.on('judgment_error', (data) => {
      errorMsg = data.message;
      judgeState = 'error';
    });
  });

  onDestroy(() => {
    socket?.disconnect();
  });
</script>

<div class="page">
  {#if judgeState === 'missing'}
    <div class="center-msg">
      <p>No battle data found.</p>
      <button class="action-btn" on:click={() => goto('/')}>Go home</button>
    </div>

  {:else}
    <div class="arena" in:fade={{ duration: 300 }}>

      <!-- Reference image -->
      <div class="ref-section">
        <p class="eyebrow">The Challenge Image</p>
        <div class="ref-frame">
          <img
            src="data:{battle.referenceImage.mimeType};base64,{battle.referenceImage.base64}"
            alt="Reference image"
            class="ref-img"
          />
        </div>

        {#if judgeState === 'done' && judgment}
          <div class="original-topic" in:fade={{ duration: 400 }}>
            <span class="original-label">Original prompt</span>
            <span class="original-text">"{judgment.originalTopic}"</span>
          </div>
        {/if}
      </div>

      <!-- Guesses -->
      <div class="guesses-row">
        <div
          class="guess-card"
          class:winner={judgment && judgment.winner === battle.playerNumber}
          class:loser={judgment && judgment.winner !== battle.playerNumber}
        >
          <div class="card-header">
            <span class="you-badge">You</span>
            {#if judgment}
              <span class="result-tag" class:win-tag={iWon} class:loss-tag={!iWon}>
                {iWon ? '🏆 Closer' : 'Further away'}
              </span>
            {/if}
          </div>
          <p class="guess-text">"{battle.myGuess}"</p>
        </div>

        <div class="vs-col">
          {#if judgeState === 'judging'}
            <div class="judge-spin">
              <div class="judge-ring"></div>
              <span class="vs-label">VS</span>
            </div>
            <p class="judge-note">Gemini is judging…</p>
          {:else}
            <span class="vs-static" in:scale={{ duration: 300 }}>VS</span>
          {/if}
        </div>

        <div
          class="guess-card"
          class:winner={judgment && judgment.winner !== battle.playerNumber}
          class:loser={judgment && judgment.winner === battle.playerNumber}
        >
          <div class="card-header">
            <span class="opp-badge">Opponent</span>
            {#if judgment}
              <span class="result-tag" class:win-tag={!iWon} class:loss-tag={iWon}>
                {!iWon ? '🏆 Closer' : 'Further away'}
              </span>
            {/if}
          </div>
          <p class="guess-text">"{battle.opponentGuess}"</p>
        </div>
      </div>

      <!-- Verdict -->
      {#if judgeState === 'done' && judgment}
        <div class="verdict" in:fade={{ duration: 500, delay: 150 }}>
          <p class="verdict-headline">{iWon ? '🎉 You guessed closer!' : '😔 Opponent guessed closer.'}</p>
          <p class="verdict-reason">"{judgment.reason}"</p>
          <button class="action-btn" on:click={() => goto('/')}>Play again</button>
        </div>
      {:else if judgeState === 'error'}
        <div class="verdict">
          <p class="verdict-reason">{errorMsg}</p>
          <button class="action-btn" on:click={() => goto('/')}>Go home</button>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    justify-content: center;
    padding: 3rem 1.5rem;
  }

  .center-msg {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-top: 20vh;
    color: var(--text-secondary);
  }

  /* ── Arena ── */
  .arena {
    width: 100%;
    max-width: 820px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
  }

  /* ── Reference image ── */
  .ref-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 480px;
  }

  .eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .ref-frame {
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--bg-border);
    box-shadow: 0 0 50px #7c3aed25;
  }

  .ref-img {
    width: 100%;
    display: block;
    object-fit: cover;
  }

  .original-topic {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    padding: 0.75rem 1.5rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-border);
    border-radius: 12px;
    text-align: center;
    width: 100%;
  }

  .original-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    color: var(--text-secondary);
  }

  .original-text {
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent-glow);
  }

  /* ── Guesses row ── */
  .guesses-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1.25rem;
    align-items: start;
    width: 100%;
  }

  .guess-card {
    background: var(--bg-card);
    border: 1px solid var(--bg-border);
    border-radius: 14px;
    padding: 1rem 1.1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: border-color 0.4s, box-shadow 0.4s, opacity 0.4s;
  }

  .guess-card.winner {
    border-color: var(--gold);
    box-shadow: 0 0 30px #f5c84225;
  }

  .guess-card.loser {
    opacity: 0.45;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .you-badge, .opp-badge {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.22rem 0.7rem;
    border-radius: 100px;
  }

  .you-badge {
    background: #7c3aed25;
    color: var(--accent-glow);
    border: 1px solid #7c3aed50;
  }

  .opp-badge {
    background: #1e1e35;
    color: var(--text-secondary);
    border: 1px solid var(--bg-border);
  }

  .result-tag {
    font-size: 0.72rem;
    font-weight: 700;
    padding: 0.22rem 0.7rem;
    border-radius: 100px;
  }

  .win-tag  { background: #f5c84220; color: var(--gold);  border: 1px solid #f5c84250; }
  .loss-tag { background: #ef444415; color: var(--loss);  border: 1px solid #ef444430; }

  .guess-text {
    font-size: 0.9rem;
    color: var(--text-primary);
    font-style: italic;
    line-height: 1.55;
  }

  /* ── VS column ── */
  .vs-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding-top: 2.5rem;
    min-width: 60px;
  }

  .judge-spin {
    position: relative;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .judge-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: var(--accent-glow);
    border-right-color: var(--accent-glow);
    animation: spin 1s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .vs-label, .vs-static {
    font-size: 0.85rem;
    font-weight: 900;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  .judge-note {
    font-size: 0.65rem;
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.4;
  }

  /* ── Verdict ── */
  .verdict {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1.75rem 2rem;
    background: var(--bg-card);
    border: 1px solid var(--bg-border);
    border-radius: 16px;
    text-align: center;
    width: 100%;
    max-width: 520px;
  }

  .verdict-headline {
    font-size: 1.7rem;
    font-weight: 800;
  }

  .verdict-reason {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.6;
    max-width: 440px;
  }

  .action-btn {
    margin-top: 0.5rem;
    padding: 0.75rem 2.5rem;
    border-radius: 100px;
    border: none;
    background: linear-gradient(135deg, #7c3aed, #a21caf);
    color: #fff;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 24px #7c3aed50;
  }

  .action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 40px #a855f770;
  }

  @media (max-width: 560px) {
    .guesses-row {
      grid-template-columns: 1fr;
    }
    .vs-col {
      flex-direction: row;
      padding-top: 0;
      justify-content: center;
    }
    .judge-note { display: none; }
  }
</style>
