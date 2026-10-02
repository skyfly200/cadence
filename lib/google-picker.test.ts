import { describe, expect, it } from 'vitest';
import { docIdFromPickerData } from './google-picker';

describe('docIdFromPickerData', () => {
  it('returns the id of the document that was picked', () => {
    expect(docIdFromPickerData({ action: 'picked', docs: [{ id: 'abcDEF123456', name: 'Trip plan' }] })).toBe('abcDEF123456');
  });

  it('returns null for a cancel, a missing pick or anything malformed', () => {
    for (const data of [null, undefined, {}, { action: 'cancel' }, { action: 'picked' }, { action: 'picked', docs: [] }, { action: 'picked', docs: [{}] }, { action: 'picked', docs: [{ id: 5 }] }, { action: 'picked', docs: [{ id: '' }] }, 'picked']) {
      expect(docIdFromPickerData(data)).toBeNull();
    }
  });
});
