/* eslint-disable no-undef */

(function () {
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }
  // Force light mode as default on initial load
  const initial = 'light';
  setTheme(initial);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme;
      setTheme(current === 'dark' ? 'light' : 'dark');
    });
  }
})();
