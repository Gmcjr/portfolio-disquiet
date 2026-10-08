let currentSeed: string | null = null;

/**
 * Simple persistent store for the seed. Uses `localStorage` when available so the
 * value survives a page reload (the "Enter" button triggers a reload).
 */
export const seedStore = {
  get(): string | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('seed');
      if (stored) {
        currentSeed = stored;
        return stored;
      }
    }
    return currentSeed;
  },
  set(seed: string): void {
    currentSeed = seed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('seed', seed);
    }
  },
  clear(): void {
    currentSeed = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('seed');
    }
  },
};
