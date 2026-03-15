import type { Queue } from 'bullmq';
import { getCaptureQueue } from '../queue.js';

export interface ScheduleJobData {
  captureRunId?: string;
  configPath: string;
  projectId: string;
  scheduleId: string;
  source: 'scheduled';
}

export class ScheduleManager {
  private queue: Queue;

  constructor(queue?: Queue) {
    this.queue = queue ?? getCaptureQueue();
  }

  /**
   * Add a BullMQ repeatable job for a schedule.
   */
  async addSchedule(
    scheduleId: string,
    cronExpression: string,
    jobData: Omit<ScheduleJobData, 'source'>,
    timezone?: string,
  ): Promise<void> {
    await this.queue.add(
      'capture',
      { ...jobData, source: 'scheduled' as const },
      {
        repeat: {
          pattern: cronExpression,
          ...(timezone ? { tz: timezone } : {}),
        },
        jobId: `schedule:${scheduleId}`,
      },
    );
  }

  /**
   * Remove a repeatable job by schedule ID.
   */
  async removeSchedule(scheduleId: string): Promise<void> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const match = repeatableJobs.find(
      (j) => j.id === `schedule:${scheduleId}` || j.key.includes(`schedule:${scheduleId}`),
    );
    if (match) {
      await this.queue.removeRepeatableByKey(match.key);
    }
  }

  /**
   * Get the next run timestamp for a schedule from BullMQ.
   */
  async getNextRun(scheduleId: string): Promise<number | null> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const match = repeatableJobs.find(
      (j) => j.id === `schedule:${scheduleId}` || j.key.includes(`schedule:${scheduleId}`),
    );
    return match?.next ?? null;
  }

  /**
   * Reconcile enabled schedules with BullMQ repeatable jobs.
   * Re-adds any enabled schedules missing from Redis (e.g., after Redis flush).
   */
  async reconcileSchedules(
    enabledSchedules: Array<{
      id: string;
      cronExpression: string;
      configPath: string;
      projectId: string;
      timezone: string;
    }>,
  ): Promise<{ added: number; removed: number }> {
    const repeatableJobs = await this.queue.getRepeatableJobs();
    const existingKeys = new Set(repeatableJobs.map((j) => j.id ?? j.key));

    let added = 0;
    let removed = 0;

    // Add missing schedules
    for (const schedule of enabledSchedules) {
      const jobId = `schedule:${schedule.id}`;
      const hasJob = [...existingKeys].some(
        (k) => k === jobId || k.includes(jobId),
      );
      if (!hasJob) {
        await this.addSchedule(
          schedule.id,
          schedule.cronExpression,
          {
            scheduleId: schedule.id,
            configPath: schedule.configPath,
            projectId: schedule.projectId,
          },
          schedule.timezone,
        );
        added++;
      }
    }

    // Remove orphaned schedule jobs (present in Redis but not in enabledSchedules)
    const enabledIds = new Set(enabledSchedules.map((s) => s.id));
    for (const job of repeatableJobs) {
      const idPart = job.id ?? job.key;
      if (idPart.startsWith('schedule:') || idPart.includes('schedule:')) {
        const scheduleId = idPart.replace(/.*schedule:/, '').split(':')[0];
        if (!enabledIds.has(scheduleId)) {
          await this.queue.removeRepeatableByKey(job.key);
          removed++;
        }
      }
    }

    return { added, removed };
  }
}
