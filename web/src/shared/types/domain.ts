export type User = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
};

export type MediaAssetKind =
  | "PROJECT_COVER_IMAGE"
  | "ORIGINAL_AUDIO"
  | "ORIGINAL_VIDEO"
  | "INSTRUMENTAL_STEM"
  | "VOCAL_STEM"
  | "RECORDED_TAKE"
  | "FINAL_MIX"
  | "FACE_SWAP_SOURCE_IMAGE"
  | "FACE_SWAP_SOURCE_VIDEO"
  | "FACE_SWAP_RESULT_VIDEO"
  | "VIDEO_CLIP"
  | "FINAL_VIDEOCLIP"
  | "KARAOKE_VIDEO"
  | "KARAOKE_PERFORMANCE_VIDEO";

export type MediaAsset = {
  id: string;
  projectId: string;
  name: string;
  origin: "UPLOADED" | "GENERATED";
  status: "UPLOADING" | "READY" | "FAILED";
  kind: MediaAssetKind;
  mimeType: string;
  sizeBytes?: string | null;
  durationSeconds?: number | null;
  storageKey: string;
  metadata?: Record<string, any> | null;
  createdAt: string;
};

export type JobType =
  | "AUDIO_SEPARATION"
  | "GENERATE_FINAL_MIX"
  | "GENERATE_KARAOKE"
  | "ANALYZE_VIDEO_FACES"
  | "FACE_SWAP"
  | "ANALYZE_AUDIO"
  | "GENERATE_STORYBOARD"
  | "GENERATE_VIDEO_CLIPS"
  | "COMPOSE_VIDEOCLIP";

export type Job = {
  id: string;
  projectId: string;
  type: JobType;
  status:
    | "PENDING"
    | "PROCESSING"
    | "WAITING_USER"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  progress: number;
  payload?: Record<string, any> | null;
  result?: Record<string, any> | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { mediaAssets: number; jobs: number };
  coverImage?: MediaAsset | null;
  mediaAssets?: MediaAsset[];
  jobs?: Job[];
};

export type StoryboardScene = {
  sceneIndex: number;
  title?: string;
  startTime: number;
  endTime: number;
  durationSeconds?: number;
  description: string;
  intensity?: string;
  visualStyle?: string;
  musicCue?: string;
  lyrics?: string;
  translatedLyrics?: string;
  generationPrompt?: string;
  visualConcept?: string;
  shotType?: "PERFORMANCE" | "NARRATIVE" | "ESTABLISHING";
  locationId?: string;
  locationDescription?: string;
  camera?: string;
  subjectAction?: string;
  showsPerformer?: boolean;
  lipSync?: boolean;
  continuityMode?: "IDENTITY_ONLY";
  sectionType?: "VERSE" | "CHORUS" | "INSTRUMENTAL";
  repetitionGroupId?: string;
  occurrenceIndex?: number;
  reusePolicy?: "MASTER" | "DIRECT" | "VARIANT";
  sourceSceneIndex?: number | null;
  repetitionScore?: number;
  textSimilarity?: number;
  musicalSimilarity?: number;
  energyDifference?: number;
};

export type AuthResponse = { accessToken: string; user: User };
