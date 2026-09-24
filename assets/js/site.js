(function () {
  var root = document.documentElement;

  // ---- Theme toggle (initial theme is applied inline in <head>)
  var toggle = document.querySelector('[data-theme-toggle]');

  function syncToggle() {
    if (toggle) toggle.setAttribute('aria-pressed', String(root.getAttribute('data-theme') === 'dark'));
  }

  if (toggle) {
    syncToggle();
    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      syncToggle();
      document.dispatchEvent(new CustomEvent('themechange'));
    });
  }

  // ---- Header border on scroll + reading progress on posts
  var header = document.querySelector('.site-header');
  var article = document.querySelector('.post-layout .post-content');
  var ticking = false;

  function update() {
    ticking = false;
    if (header) header.classList.toggle('is-scrolled', window.scrollY > 8);
    if (header && article) {
      var rect = article.getBoundingClientRect();
      var start = rect.top + window.scrollY - window.innerHeight * 0.4;
      var end = rect.bottom + window.scrollY - window.innerHeight;
      var progress = (window.scrollY - start) / Math.max(end - start, 1);
      header.style.setProperty('--progress', Math.min(1, Math.max(0, progress)).toFixed(4));
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
})();
