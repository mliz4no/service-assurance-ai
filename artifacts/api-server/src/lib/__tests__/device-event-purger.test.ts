import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDeviceEventRetentionHours,
  getPurgeBatchOffset,
} from '../device-event-purger';

describe('device event purge configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses category-specific retention defaults and valid overrides', () => {
    expect(getDeviceEventRetentionHours()).toEqual({
      default: 24,
      incident_evidence: 2160,
      audit: 8760,
      legal: 61320,
    });

    vi.stubEnv('EVENT_PURGE_RETENTION_DEFAULT_HOURS', '48');
    vi.stubEnv('EVENT_PURGE_RETENTION_AUDIT_HOURS', 'invalid');
    expect(getDeviceEventRetentionHours()).toMatchObject({ default: 48, audit: 8760 });
  });

  it('advances dry-run batches while real deletion reuses the first page', () => {
    expect(getPurgeBatchOffset(true, 3, 1000)).toBe(3000);
    expect(getPurgeBatchOffset(false, 3, 1000)).toBe(0);
  });
});