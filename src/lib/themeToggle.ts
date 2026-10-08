// src/lib/themeToggle.ts
/**
 * Helper module for the light/dark theme toggle. All DOM access is
 * client‑side only; safe to import from an Astro component.
 */

type IconElements = {
  iconLight: HTMLElement | null;
  iconDark: HTMLElement | null;
};

type ThemeElements = {
  toggle: HTMLButtonElement | null;
} & IconElements;

/**
 * Grab the elements we need from the page.
 * The function returns `null` for elements that cannot be found – callers
 * must handle that gracefully.
 */
export const getThemeElements = (): ThemeElements => ({
  toggle: document.querySelector<HTMLButtonElement>('#theme-toggle'),
  iconLight: document.getElementById('icon-light'),
  iconDark: document.getElementById('icon-dark'),
});

/** Update the sun/moon icons based on the current theme. */
export const updateIcon = (theme: string, icons: IconElements): void => {
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

/** Persist the theme and update the UI. */
export const setTheme = (theme: string, icons: IconElements): void => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('theme', theme);
  updateIcon(theme, icons);
};

/** Initialise the toggle button and set the correct icon on page load. */
export const initThemeToggle = (): void => {
  // Guard against server‑side render (SSR) – `document` is undefined there.
  if (typeof document === 'undefined') return;

  const { toggle, iconLight, iconDark } = getThemeElements();

  if (toggle) {
    toggle.addEventListener('click', () => {
      const newTheme =
        document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme, { iconLight, iconDark });
    });
  }

  // Initialise the correct icon based on the persisted or system theme.
  updateIcon(document.documentElement.dataset.theme || 'light', {
    iconLight,
    iconDark,
  });
};
