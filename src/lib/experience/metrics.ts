import type { Metric } from './types.js';

const metrics: Metric[] = [];

/** Record a metric during the session. */
export function pushMetric(metric: Metric): void {
  metrics.push(metric);
}

/** Summarise the collected metrics for the exit recap. */
export function summarise() {
  const timeMetrics = metrics.filter(
    (m): m is Extract<Metric, { type: 'time' }> => m.type === 'time',
  );
  const totalTimeMs = timeMetrics.reduce((sum, m) => sum + m.durationMs, 0);

  const clickCount = metrics.filter((m) => m.type === 'click').length;
  const sketchActions = metrics.filter((m) => m.type === 'sketch').length;

  return {
    totalTimeMs,
    clickCount,
    sketchActions,
  };
}
