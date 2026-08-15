import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMonitoringScheduler } from '../monitoring-scheduler';

describe('monitoring scheduler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs immediately and on the configured interval', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue({ processed: 2, createdTickets: 1, updatedTickets: 0 });

    const scheduler = createMonitoringScheduler({
      intervalMs: 1_000,
      run,
      runImmediately: true,
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('prevents overlapping executions and stops future runs', async () => {
    vi.useFakeTimers();
    let finish: ((value: { processed: number; createdTickets: number; updatedTickets: number }) => void) | undefined;
    const run = vi.fn(
      () =>
        new Promise<{ processed: number; createdTickets: number; updatedTickets: number }>((resolve) => {
          finish = resolve;
        }),
    );

    const scheduler = createMonitoringScheduler({ intervalMs: 100, run });
    const firstRun = scheduler.runNow();
    const overlappingRun = await scheduler.runNow();

    expect(overlappingRun).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);

    finish?.({ processed: 1, createdTickets: 0, updatedTickets: 0 });
    await firstRun;
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(500);
    expect(run).toHaveBeenCalledTimes(1);
  });
});