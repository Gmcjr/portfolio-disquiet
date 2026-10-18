/* global document, localStorage, Element */
// Theme: dark by default; the toggle stores the visitor's choice.
// Loaded as a blocking classic script in <head> so the theme is set before
// first paint. It is a file, not inline, because the CSP blocks inline scripts.
// Listeners sit on document, so they survive ClientRouter page swaps.
(function () {
  var KEY = 'theme';
  var DEFAULT_THEME = 'dark';

  function storedTheme() {
    try {
      var value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    var button = document.getElementById('theme-toggle');
    if (button) button.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  function currentTheme() {
    return storedTheme() || DEFAULT_THEME;
  }

  apply(currentTheme());

  // The toggle button does not exist yet when this runs in <head>.
  document.addEventListener('DOMContentLoaded', function () {
    apply(currentTheme());
  });
  // ClientRouter replaces the <html> attributes on each navigation.
  document.addEventListener('astro:after-swap', function () {
    apply(currentTheme());
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!(target instanceof Element) || !target.closest('#theme-toggle')) {
      return;
    }
    var next =
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice lasts until the next full page load.
    }
    apply(next);
  });
})();
