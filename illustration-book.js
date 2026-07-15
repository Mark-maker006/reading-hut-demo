(function () {
  const buttons = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.catalog-content');

  if (!buttons.length) return;

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      buttons.forEach(b => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
      });
      contents.forEach(c => {
        c.classList.toggle('is-active', c.dataset.tab === target);
      });
    });
  });
})();
