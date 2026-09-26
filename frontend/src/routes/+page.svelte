<script>
  import { onMount } from 'svelte';
  import { BACKEND_URL } from '$lib/backend';

  let leaderboard = [];
  let loading = true;
  let error = null;

  onMount(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/leaderboard`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      leaderboard = await res.json();
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  });

  function rankColor(rank) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return 'default';
  }

  function rankLabel(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  }

  function winRate(wins, losses) {
    const total = wins + losses;
    if (total === 0) return '0%';
    return `${Math.round((wins / total) * 100)}%`;
  }
</script>

<main>
  <!-- Hero -->
  <section class="hero">
    <div class="hero-bg" aria-hidden="true">
      <div class="orb orb-left"></div>
      <div class="orb orb-right"></div>
    </div>

    <div class="hero-content">
      <p class="eyebrow">AI · Image · Battle</p>
      <h1 class="title">
        <img src="/logo.png" alt="Clash of Slop" class="title-logo" />
      </h1>
      <p class="subtitle">
        Write the sharpest prompt. Generate the best image.<br />
        Let AI decide who wins.
      </p>

      <a href="/battle" class="battle-btn">
        <span class="btn-glow"></span>
        <span class="btn-text">⚔ Enter Battle</span>
      </a>
    </div>
  </section>

  <!-- Leaderboard -->
  <section class="leaderboard-section">
    <h2 class="section-title">
      <span class="title-icon">🏆</span> Leaderboard
    </h2>

    {#if loading}
      <div class="state-msg">Loading rankings...</div>
    {:else if error}
      <div class="state-msg error">Could not load leaderboard — is the backend running?</div>
    {:else}
      <div class="table-wrap">
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th class="col-rank">Rank</th>
              <th class="col-user">Player</th>
              <th class="col-score">Score</th>
              <th class="col-record">W / L</th>
              <th class="col-rate">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {#each leaderboard as entry (entry.rank)}
              <tr class="row rank-{rankColor(entry.rank)}">
                <td class="col-rank">
                  <span class="rank-badge">{rankLabel(entry.rank)}</span>
                </td>
                <td class="col-user">
                  <span class="avatar">{entry.username[0].toUpperCase()}</span>
                  <span class="username">{entry.username}</span>
                </td>
                <td class="col-score">{entry.score.toLocaleString()}</td>
                <td class="col-record">
                  <span class="wins">{entry.wins}W</span>
                  <span class="sep">/</span>
                  <span class="losses">{entry.losses}L</span>
                </td>
                <td class="col-rate">{winRate(entry.wins, entry.losses)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</main>

<style>
  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* ── Hero ── */
  .hero {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 7rem 1.5rem 5rem;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    opacity: 0.18;
  }

  .orb-left {
    width: 500px;
    height: 500px;
    background: #4d8f00;
    top: -100px;
    left: -180px;
  }

  .orb-right {
    width: 400px;
    height: 400px;
    background: #cc1111;
    bottom: -80px;
    right: -120px;
  }

  .hero-content {
    position: relative;
    text-align: center;
    max-width: 680px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .eyebrow {
    letter-spacing: 0.25em;
    text-transform: uppercase;
    font-size: 0.75rem;
    color: var(--accent-glow);
    font-weight: 600;
  }

  .title {
    margin: 0;
    line-height: 1;
  }

  .title-logo {
    height: 70vh;
    width: auto;
    display: block;
  }

  .subtitle {
    font-size: 1.1rem;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: 480px;
  }

  /* ── Battle Button ── */
  .battle-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 0.5rem;
    padding: 1.1rem 3.2rem;
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: #fff;
    background: linear-gradient(135deg, #3a7a00, #6ab000);
    border-radius: 100px;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 0 30px #4d8f0060, 0 4px 20px #00000060;
    text-decoration: none;
  }

  .battle-btn:hover {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 0 60px #7fc80080, 0 8px 30px #00000070;
  }

  .battle-btn:active {
    transform: translateY(-1px) scale(1.01);
  }

  .btn-glow {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(135deg, #7fc80040, #6ab00040);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .battle-btn:hover .btn-glow {
    opacity: 1;
  }

  .btn-text {
    position: relative;
    z-index: 1;
  }


  /* ── Leaderboard Section ── */
  .leaderboard-section {
    width: 100%;
    max-width: 780px;
    padding: 0 1.5rem 6rem;
  }

  .section-title {
    font-size: 1.6rem;
    font-weight: 700;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-icon {
    font-size: 1.4rem;
  }

  .state-msg {
    text-align: center;
    color: var(--text-secondary);
    padding: 3rem 0;
    font-size: 0.95rem;
  }

  .state-msg.error {
    color: var(--loss);
  }

  .table-wrap {
    border-radius: 16px;
    overflow: hidden;
    border: 1px solid var(--bg-border);
    background: var(--bg-card);
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .leaderboard-table thead tr {
    background: #0a180a50;
  }

  .leaderboard-table th {
    padding: 0.85rem 1.2rem;
    text-align: left;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--text-secondary);
    font-weight: 600;
    border-bottom: 1px solid var(--bg-border);
  }

  .leaderboard-table td {
    padding: 0.85rem 1.2rem;
    border-bottom: 1px solid var(--bg-border);
    vertical-align: middle;
  }

  .row:last-child td {
    border-bottom: none;
  }

  .row {
    transition: background 0.1s;
  }

  .row:hover {
    background: #ffffff06;
  }

  .row.rank-gold {
    background: #f5c84208;
  }

  .row.rank-silver {
    background: #b0b8c808;
  }

  .row.rank-bronze {
    background: #cd7f3208;
  }

  .rank-badge {
    font-size: 1rem;
    min-width: 2rem;
    display: inline-block;
    text-align: center;
    color: var(--text-secondary);
    font-weight: 600;
  }

  .rank-gold .rank-badge   { color: var(--gold);   }
  .rank-silver .rank-badge { color: var(--silver); }
  .rank-bronze .rank-badge { color: var(--bronze); }

  td.col-user {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent-glow));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  .username {
    font-weight: 600;
    color: var(--text-primary);
  }

  .col-score {
    font-weight: 700;
    color: var(--accent-glow);
  }

  .wins   { color: var(--win);  font-weight: 600; }
  .losses { color: var(--loss); font-weight: 600; }
  .sep    { color: var(--text-secondary); margin: 0 0.25rem; }

  .col-rate {
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* ── Column widths ── */
  .col-rank  { width: 70px; }
  .col-score { width: 100px; }
  .col-record { width: 110px; }
  .col-rate  { width: 90px; }

  @media (max-width: 520px) {
    .stats-row { gap: 1rem; }
    .leaderboard-table th,
    .leaderboard-table td { padding: 0.7rem 0.8rem; }
    .col-rate { display: none; }
  }
</style>
