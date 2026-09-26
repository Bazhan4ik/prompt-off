<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { io } from 'socket.io-client';
  import { goto } from '$app/navigation';
  import { battleStore } from '$lib/battleStore';
  import { get } from 'svelte/store';

  let battle = get(battleStore);

  /** @type {'judging' | 'done' | 'error' | 'missing'} */
  let judgeState = battle ? 'judging' : 'missing';

  /** @type {{ winner: 1 | 2, reason: string } | null} */
  let judgment = null;
  let errorMsg = '';
  let socket;

  $: iWon = judgment && battle && judgment.winner === battle.playerNumber;

  onMount(() => {
    if (!battle) return;

    socket = io();
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
      <button class="back-btn" on:click={() => goto('/')}>Go home</button>
    </div>

  {:else}
    <div class="arena" in:fade={{ duration: 300 }}>

      <div class="header">
        <p class="eyebrow">Topic</p>
        <h1 class="topic">{battle.topic}</h1>
      </div>

      <div class="images-row">
        <!-- My card -->
        <div
          class="player-card"
          class:winner={judgment && judgment.winner === battle.playerNumber}
          class:loser={judgment && judgment.winner !== battle.playerNumber}
        >
          <div class="card-label">
            <span class="you-badge">You</span>
            {#if judgment}
              <span class="result-tag" class:win-tag={iWon} class:loss-tag={!iWon}>
                {iWon ? '🏆 Winner' : 'Defeated'}
              </span>
            {/if}
          </div>
          <div class="image-frame">
            <img
              src="data:{battle.myImage.mimeType};base64,{battle.myImage.base64}"
              alt="Your generated image"
            />
          </div>
          <p class="prompt-text">"{battle.myPrompt}"</p>
        </div>

        <!-- VS divider -->
        <div class="vs-column">
          {#if judgeState === 'judging'}
            <div class="judging-indicator">
              <div class="judge-ring"></div>
              <span class="vs-text">VS</span>
            </div>
            <p class="judge-label">Gemini is judging…</p>
          {:else if judgeState === 'done'}
            <div class="vs-done" in:scale={{ duration: 400, start: 0.5 }}>VS</div>
          {:else}
            <div class="vs-done">VS</div>
          {/if}
        </div>

        <!-- Opponent card -->
        <div
          class="player-card"
          class:winner={judgment && judgment.winner !== battle.playerNumber}
          class:loser={judgment && judgment.winner === battle.playerNumber}
        >
          <div class="card-label">
            <span class="opp-badge">Opponent</span>
            {#if judgment}
              <span class="result-tag" class:win-tag={!iWon} class:loss-tag={iWon}>
                {!iWon ? '🏆 Winner' : 'Defeated'}
              </span>
            {/if}
          </div>
          <div class="image-frame">
            <img
              src="data:{battle.opponentImage.mimeType};base64,{battle.opponentImage.base64}"
              alt="Opponent's generated image"
            />
          </div>
          <p class="prompt-text">"{battle.opponentPrompt}"</p>
        </div>
      </div>

      <!-- Verdict -->
      {#if judgeState === 'done' && judgment}
        <div class="verdict" in:fade={{ duration: 500, delay: 200 }}>
          <p class="verdict-headline">
            {iWon ? '🎉 You win!' : '😔 You lose.'}
          </p>
          <p class="verdict-reason">"{judgment.reason}"</p>
          <button class="play-again-btn" on:click={() => goto('/')}>Play again</button>
        </div>
      {:else if judgeState === 'error'}
        <div class="verdict error-verdict">
          <p class="verdict-reason">{errorMsg}</p>
          <button class="play-again-btn" on:click={() => goto('/')}>Go home</button>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    align-items: flex-start;
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
    max-width: 1000px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2.5rem;
  }

  .header {
    text-align: center;
  }

  .eyebrow {
    font-size: 0.7rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-secondary);
    margin-bottom: 0.4rem;
  }

  .topic {
    font-size: clamp(1.4rem, 3.5vw, 2rem);
    font-weight: 800;
    color: var(--text-primary);
  }

  /* ── Images row ── */
  .images-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1.5rem;
    align-items: start;
    width: 100%;
  }

  /* ── Player card ── */
  .player-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    border-radius: 16px;
    border: 1px solid var(--bg-border);
    background: var(--bg-card);
    padding: 1rem;
    transition: border-color 0.4s, box-shadow 0.4s, opacity 0.4s;
  }

  .player-card.winner {
    border-color: var(--gold);
    box-shadow: 0 0 40px #f5c84230, 0 0 80px #f5c84210;
  }

  .player-card.loser {
    opacity: 0.5;
  }

  .card-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .you-badge, .opp-badge {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.25rem 0.75rem;
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
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.75rem;
    border-radius: 100px;
  }

  .win-tag {
    background: #f5c84220;
    color: var(--gold);
    border: 1px solid #f5c84250;
  }

  .loss-tag {
    background: #ef444415;
    color: var(--loss);
    border: 1px solid #ef444430;
  }

  .image-frame {
    border-radius: 10px;
    overflow: hidden;
    background: var(--bg-deep);
    aspect-ratio: 1;
  }

  .image-frame img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .prompt-text {
    font-size: 0.82rem;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.5;
  }

  /* ── VS column ── */
  .vs-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding-top: 3.5rem;
    min-width: 72px;
  }

  .judging-indicator {
    position: relative;
    width: 52px;
    height: 52px;
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

  .vs-text {
    font-size: 0.9rem;
    font-weight: 900;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  .judge-label {
    font-size: 0.7rem;
    color: var(--text-secondary);
    text-align: center;
    line-height: 1.4;
  }

  .vs-done {
    font-size: 1.2rem;
    font-weight: 900;
    color: var(--text-secondary);
    letter-spacing: 0.05em;
  }

  /* ── Verdict ── */
  .verdict {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem;
    border-radius: 16px;
    border: 1px solid var(--bg-border);
    background: var(--bg-card);
    width: 100%;
    max-width: 560px;
  }

  .error-verdict {
    border-color: #ef444430;
  }

  .verdict-headline {
    font-size: 1.8rem;
    font-weight: 800;
  }

  .verdict-reason {
    font-size: 0.95rem;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.6;
    max-width: 460px;
  }

  .play-again-btn, .back-btn {
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

  .play-again-btn:hover, .back-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 40px #a855f770;
  }

  /* ── Mobile ── */
  @media (max-width: 640px) {
    .images-row {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }

    .vs-column {
      flex-direction: row;
      padding-top: 0;
      justify-content: center;
    }

    .judge-label { display: none; }
  }
</style>
