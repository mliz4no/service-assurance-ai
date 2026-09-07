import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getProbeMaxTargetsPerRun,
  isTargetDue,
  summarizeProbeResults,
} from '../monitoring-execution';

describe('monitoring execution cadence', () => {
  const nowMs = Date.parse('2026-09-01T12:00:00.000Z');

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('runs targets without a prior check or configured cadence', () => {
    expect(isTargetDue({ lastCheckedAt: null, probeCadenceSeconds: 300 }, nowMs)).toBe(true);
    expect(
      isTargetDue({ lastCheckedAt: new Date(nowMs), probeCadenceSeconds: null }, nowMs),
    ).toBe(true);
  });

  it('waits until the configured cadence has elapsed', () => {
    const lastCheckedAt = new Date(nowMs - 299_000);

    expect(isTargetDue({ lastCheckedAt, probeCadenceSeconds: 300 }, nowMs)).toBe(false);
    expect(isTargetDue({ lastCheckedAt, probeCadenceSeconds: 299 }, nowMs)).toBe(true);
  });

  it('uses a bounded configurable target budget', () => {
    expect(getProbeMaxTargetsPerRun()).toBe(100);

    vi.stubEnv('PROBE_MAX_TARGETS_PER_RUN', '2');
    expect(getProbeMaxTargetsPerRun()).toBe(2);

    vi.stubEnv('PROBE_MAX_TARGETS_PER_RUN', 'invalid');
    expect(getProbeMaxTargetsPerRun()).toBe(100);
  });

  it('summarizes probe outcomes without treating every unknown as blocked', () => {
    const summary = summarizeProbeResults([
      { checkType: 'http', status: 'up', responseTimeMs: 20, payload: {} },
      { checkType: 'dns', status: 'unknown', responseTimeMs: 5, payload: {} },
      {
        checkType: 'tcp',
        status: 'unknown',
        responseTimeMs: 0,
        payload: { blocked: true },
      },
    ]);

    expect(summary.blocked).toBe(1);
    expect(summary.statuses).toEqual({ up: 1, down: 0, degraded: 0, unknown: 2 });
    expect(summary.checkTypes).toEqual({ http: 1, tcp: 1, icmp: 0, dns: 1, tls: 0 });
  });
});