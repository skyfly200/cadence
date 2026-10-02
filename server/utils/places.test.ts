import { describe, expect, it, vi } from 'vitest';
import { CACHE_TTL_MS, createPlaceResolver } from './places';

const reply = (items: unknown[]) => vi.fn(async () => new Response(JSON.stringify(items)));
const oak = { display_name: 'Oak Street Clinic, 12, Oak Street, Springfield, Greene County, Missouri, United States', lat: '37.2', lon: '-93.3' };

describe('createPlaceResolver', () => {
  it('turns a place name into a short address and coordinates', async () => {
    const f = reply([oak]);
    const r = createPlaceResolver({ fetch: f as unknown as typeof fetch });
    const places = await r.resolve('Oak Street Clinic');
    expect(places).toEqual([{ label: oak.display_name, address: 'Oak Street Clinic, 12, Oak Street, Springfield', lat: 37.2, lon: -93.3 }]);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('q=Oak%20Street%20Clinic');
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Cadence/);
  });

  it('offers at most three matches and drops results with no position', async () => {
    const f = reply([oak, oak, oak, oak, { display_name: 'No position' }]);
    const places = await createPlaceResolver({ fetch: f as unknown as typeof fetch }).resolve('Oak Street Clinic');
    expect(places).toHaveLength(3);
  });

  it('answers no matches for too-short names, a failed lookup or a network error, without throwing', async () => {
    const f = reply([oak]);
    const r = createPlaceResolver({ fetch: f as unknown as typeof fetch });
    expect(await r.resolve('ab')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(await createPlaceResolver({ fetch: (async () => new Response('no', { status: 500 })) as typeof fetch }).resolve('Somewhere')).toEqual([]);
    expect(await createPlaceResolver({ fetch: (async () => { throw new Error('offline'); }) as typeof fetch }).resolve('Somewhere')).toEqual([]);
  });

  it('caches a name for an hour, then asks again', async () => {
    const f = reply([oak]);
    let t = 0;
    const r = createPlaceResolver({ fetch: f as unknown as typeof fetch, now: () => t });
    await r.resolve('Oak Street Clinic');
    await r.resolve('  oak street   clinic ');
    expect(f).toHaveBeenCalledTimes(1);
    t = CACHE_TTL_MS + 1;
    await r.resolve('Oak Street Clinic');
    expect(f).toHaveBeenCalledTimes(2);
  });
});
