// The quality ladder: how the visual engine stays inside its frame budget on
// content pages (frontend plan D-7). Pure: the scheduler measures tick times and
// applies the level that this function returns.

/** 0: full; 1: 0.75× pixels; 2: 0.5× pixels; 3: half the particles; 4: 30 fps. */
export type QualityLevel = 0 | 1 | 2 | 3 | 4;

export const TICK_BUDGET_MS = 4;
const STEP_UP_BELOW_MS = 2;
const WINDOW = 60;
const STEP_DOWN_GAP_MS = 1000;
const STEP_UP_GAP_MS = 10_000;

export const PIXEL_SCALE: Readonly<Record<QualityLevel, number>> = {
  0: 1,
  1: 0.75,
  2: 0.5,
  3: 0.5,
  4: 0.5,
};

export function nextQuality(
  durationsMs: readonly number[],
  level: QualityLevel,
  lastChangeMs: number,
  nowMs: number,
): QualityLevel {
  if (durationsMs.length < WINDOW) return level;
  const recent = durationsMs.slice(-WINDOW);
  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const since = nowMs - lastChangeMs;
  if (mean > TICK_BUDGET_MS && level < 4 && since >= STEP_DOWN_GAP_MS) {
    return (level + 1) as QualityLevel;
  }
  if (mean < STEP_UP_BELOW_MS && level > 0 && since >= STEP_UP_GAP_MS) {
    return (level - 1) as QualityLevel;
  }
  return level;
}
