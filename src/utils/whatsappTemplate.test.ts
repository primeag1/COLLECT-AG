import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WA_TEMPLATE,
  getSavedWaTemplate,
  WA_TEMPLATE_STORAGE_KEY,
} from './whatsappTemplate';

describe('getSavedWaTemplate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the default when no template has been saved', () => {
    const getItem = vi.fn(() => null);
    vi.stubGlobal('localStorage', { getItem });

    expect(getSavedWaTemplate()).toBe(DEFAULT_WA_TEMPLATE);
    expect(getItem).toHaveBeenCalledWith(WA_TEMPLATE_STORAGE_KEY);
  });

  it('returns the saved template', () => {
    const getItem = vi.fn(() => 'Hi {{name}}');
    vi.stubGlobal('localStorage', { getItem });

    expect(getSavedWaTemplate()).toBe('Hi {{name}}');
  });
});
