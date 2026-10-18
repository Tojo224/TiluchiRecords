const MIME_BY_EXTENSION: Record<string, string> = {
  ".avi": "video/x-msvideo",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".m4a": "audio/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".mpeg": "video/mpeg",
  ".mpg": "video/mpeg",
  ".png": "image/png",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

export const MUSIC_FILE_ACCEPT =
  "audio/*,video/mp4,video/mpeg,.mp3,.m4a,.mp4,.mpeg,.mpg";
export const VIDEO_FILE_ACCEPT = "video/*,.mp4,.mpeg,.mpg,.mov,.avi,.webm";
export const IMAGE_FILE_ACCEPT = "image/*,.png,.jpg,.jpeg,.webp";

export function resolveMediaMimeType(fileName: string, browserMime: string) {
  if (browserMime) return browserMime;

  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}
