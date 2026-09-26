<script>
  import '../app.css';
</script>

<div class="bg-logo" aria-hidden="true">
  <img src="/logo.jpg" alt="" />
</div>

<slot />

<style>
  .bg-logo {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: -1;
  }

  .bg-logo img {
    width: 680px;
    max-width: 85vw;
    opacity: 0.045;
    filter: grayscale(20%) saturate(1.4);
    user-select: none;
  }
</style>
