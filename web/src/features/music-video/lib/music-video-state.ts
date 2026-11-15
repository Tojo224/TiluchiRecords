import { selectJobForType } from "@/features/jobs/hooks/useJobForType";
import type { Job, MediaAsset, StoryboardScene } from "@/shared/types/domain";

export function deriveMusicVideoState(
  projectJobs: Job[] | undefined,
  projectMediaAssets: MediaAsset[] | undefined,
  audioId: string,
) {
  const jobs = projectJobs || [];
  const analysisJob = selectJobForType(
    jobs,
    "ANALYZE_AUDIO",
    (job) => job.payload?.audioAssetId === audioId,
  );
  const analysis =
    analysisJob?.status === "COMPLETED" ? analysisJob : undefined;
  const storyboardJob = selectJobForType(
    jobs,
    "GENERATE_STORYBOARD",
    (job) => job.payload?.analysisJobId === analysis?.id,
  );
  const storyboard =
    storyboardJob?.status === "COMPLETED" &&
    storyboardJob.result?.schemaVersion === "music-video-v2"
      ? storyboardJob
      : undefined;
  const clipJob = selectJobForType(
    jobs,
    "GENERATE_VIDEO_CLIPS",
    (job) => job.payload?.storyboardJobId === storyboard?.id,
  );
  const completedClipJob =
    clipJob?.status === "COMPLETED" ? clipJob : undefined;
  const clips = (projectMediaAssets || []).filter(
    (asset) =>
      asset.kind === "VIDEO_CLIP" &&
      asset.status === "READY" &&
      asset.metadata?.sourceJobId === completedClipJob?.id,
  );
  const composeJob = selectJobForType(
    jobs,
    "COMPOSE_VIDEOCLIP",
    (job) =>
      job.payload?.audioAssetId === audioId &&
      (job.payload?.clipJobId === completedClipJob?.id ||
        (clips.length > 0 &&
          clips.every((clip) => job.payload?.clipAssetIds?.includes(clip.id)))),
  );
  const finalVideo = (projectMediaAssets || []).find(
    (asset) =>
      asset.kind === "FINAL_VIDEOCLIP" &&
      asset.status === "READY" &&
      asset.metadata?.sourceJobId === composeJob?.id,
  );
  return {
    analysis,
    analysisJob,
    storyboard,
    storyboardJob,
    clipJob,
    composeJob,
    clips,
    finalVideo,
    scenes: (Array.isArray(storyboard?.result?.scenes)
      ? storyboard.result.scenes
      : []) as StoryboardScene[],
  };
}

export type MusicVideoState = ReturnType<typeof deriveMusicVideoState>;
