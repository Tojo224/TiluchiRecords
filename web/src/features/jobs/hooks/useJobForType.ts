import type { Job, JobType } from "@/shared/types/domain";

export type JobFlags = {
  running: boolean;
  failed: boolean;
  completed: boolean;
};

export type JobForType = JobFlags & { job: Job | undefined };

export type JobMatcher = (job: Job) => boolean;

/**
 * Returns the first job (list order) of the given type that satisfies the
 * optional payload matcher. Callers keep the list order they always used.
 */
export function selectJobForType(
  jobs: readonly Job[] | null | undefined,
  type: JobType,
  matches?: JobMatcher,
): Job | undefined {
  return (jobs || []).find(
    (job) => job.type === type && (!matches || matches(job)),
  );
}

export function getJobFlags(job: Job | undefined): JobFlags {
  return {
    running: job?.status === "PENDING" || job?.status === "PROCESSING",
    failed: job?.status === "FAILED",
    completed: job?.status === "COMPLETED",
  };
}

export function resolveJobForType(
  jobs: readonly Job[] | null | undefined,
  type: JobType,
  matches?: JobMatcher,
): JobForType {
  const job = selectJobForType(jobs, type, matches);
  return { job, ...getJobFlags(job) };
}

export function useJobForType(
  jobs: readonly Job[] | null | undefined,
  type: JobType,
  matches?: JobMatcher,
): JobForType {
  return resolveJobForType(jobs, type, matches);
}
