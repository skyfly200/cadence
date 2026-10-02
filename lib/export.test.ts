import { describe, expect, it } from 'vitest';
import { buildExport, exportFilename } from './export';

const NOW = new Date(Date.UTC(2026, 9, 3, 12));

describe('export', () => {
  it('wraps the data with a timestamp and names the file by day', () => {
    const data = { 'cadence:graphNodes': [{ id: 'a' }], 'cadence:tasks': [] };
    expect(buildExport(data, NOW)).toEqual({ app: 'cadence', exportedAt: NOW.toISOString(), data });
    expect(exportFilename(NOW)).toBe('cadence-export-2026-10-03.json');
  });
});
