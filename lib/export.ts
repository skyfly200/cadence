/** Export everything: one JSON document holding everything this device has (the Home graph and the classic view's data). */
export interface ExportDoc {
  app: 'cadence';
  exportedAt: string;
  /** Every `cadence:` localStorage key (graph nodes, links and occurrences, classic tasks and settings, ...), Google tokens already stripped. */
  data: Record<string, unknown>;
}

export function buildExport(data: Record<string, unknown>, now: Date = new Date()): ExportDoc {
  return { app: 'cadence', exportedAt: now.toISOString(), data };
}

export function exportFilename(now: Date = new Date()): string {
  return `cadence-export-${now.toISOString().slice(0, 10)}.json`;
}
