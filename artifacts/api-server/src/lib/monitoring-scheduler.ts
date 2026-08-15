import { logger } from './logger';

export type MonitoringJobResult = {
  processed: number;
  createdTickets: number;
  updatedTickets: number;
};

export type MonitoringScheduler = {
  stop(): void;
  runNow(): Promise<MonitoringJobResult | null>;
};

export function createMonitoringScheduler(options: {
  intervalMs: number;
  run: () => Promise<MonitoringJobResult>;
  runImmediately?: boolean;
  jobName?: string;
}): MonitoringScheduler {
  const jobName = options.jobName ?? 'monitoring';
  let running = false;
  let stopped = false;

  const runNow = async (): Promise<MonitoringJobResult | null> => {
    if (running || stopped) {
      logger.warn({ jobName, running, stopped }, 'Monitoring job skipped');
      return null;
    }

    running = true;
    const startedAt = Date.now();
    try {
      const result = await options.run();
      logger.info({ jobName, durationMs: Date.now() - startedAt, ...result }, 'Monitoring job completed');
      return result;
    } catch (error) {
      logger.error({ jobName, durationMs: Date.now() - startedAt, error }, 'Monitoring job failed');
      return null;
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void runNow();
  }, options.intervalMs);
  timer.unref();

  if (options.runImmediately) {
    void runNow();
  }

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
    runNow,
  };
}