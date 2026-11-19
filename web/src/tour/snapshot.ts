import { deriveMusicVideoState } from "@/features/music-video/lib/music-video-state";
import type {
  MediaAsset,
  MediaAssetKind,
  Project,
} from "@/shared/types/domain";

/** Flat, primitives-only view of what the user has done (cheap to compare). */
export type TourSnapshot = {
  projectCount: number;
  videoCount: number;
  audioCount: number;
  karaokeReady: boolean;
  performanceCount: number;
  storyboardReady: boolean;
  finalVideoReady: boolean;
  faceSwapResultCount: number;
};

export const EMPTY_TOUR_SNAPSHOT: TourSnapshot = {
  projectCount: 0,
  videoCount: 0,
  audioCount: 0,
  karaokeReady: false,
  performanceCount: 0,
  storyboardReady: false,
  finalVideoReady: false,
  faceSwapResultCount: 0,
};

function readyOfKind(assets: MediaAsset[], kind: MediaAssetKind) {
  return assets.filter(
    (asset) => asset.kind === kind && asset.status === "READY",
  );
}

/** Derives the project-scoped part of the snapshot from a loaded project. */
export function snapshotFromProject(project: Project): Partial<TourSnapshot> {
  const assets = project.mediaAssets ?? [];
  const uploaded = (kind: MediaAssetKind) =>
    readyOfKind(assets, kind).filter((asset) => asset.origin === "UPLOADED");
  const audios = uploaded("ORIGINAL_AUDIO");
  return {
    videoCount: uploaded("ORIGINAL_VIDEO").length,
    audioCount: audios.length,
    karaokeReady: readyOfKind(assets, "KARAOKE_VIDEO").length > 0,
    performanceCount: readyOfKind(assets, "KARAOKE_PERFORMANCE_VIDEO").length,
    storyboardReady: audios.some(
      (audio) =>
        deriveMusicVideoState(project.jobs, assets, audio.id).storyboard !==
        undefined,
    ),
    finalVideoReady: readyOfKind(assets, "FINAL_VIDEOCLIP").length > 0,
    faceSwapResultCount: readyOfKind(assets, "FACE_SWAP_RESULT_VIDEO").length,
  };
}

export function mergeSnapshot(
  base: TourSnapshot,
  patch: Partial<TourSnapshot>,
): TourSnapshot {
  return { ...base, ...patch };
}

/** Shallow equality; snapshots only hold primitives. */
export function sameSnapshot(a: TourSnapshot, b: TourSnapshot): boolean {
  return (Object.keys(EMPTY_TOUR_SNAPSHOT) as (keyof TourSnapshot)[]).every(
    (key) => a[key] === b[key],
  );
}
