/* global document, localStorage */
// Fallback JS for theme toggle (same as src/lib/themeToggle.js)
export const getThemeElements = () => ({
  toggle: document.querySelector('#theme-toggle'),
  iconLight: document.getElementById('icon-light'),
  iconDark: document.getElementById('icon-dark'),
});

export const updateIcon = (theme, icons) => {
  const { iconLight, iconDark } = icons;
  if (!iconLight || !iconDark) return;
  if (theme === 'dark') {
    iconDark.classList.remove('hidden');
    iconLight.classList.add('hidden');
  } else {
    iconLight.classList.remove('hidden');
    iconDark.classList.add('hidden');
  }
};

export const setTheme = (theme, icons) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  updateIcon(theme, icons);
};

export const initThemeToggle = () => {
  if (typeof document === 'undefined') return;
  const { toggle, iconLight, iconDark } = getThemeElements();
  if (toggle) {
    toggle.addEventListener('click', () => {
      const newTheme =
        document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme, { iconLight, iconDark });
    });
  }
  updateIcon(document.documentElement.dataset.theme || 'light', {
    iconLight,
    iconDark,
  });
};
