export type EmailAttachmentConfig = {
  enabled: boolean;
  maxBytesPerFile: number;
  maxFilesPerEmail: number;
  allowImages: boolean;
  allowVideos: boolean;
};

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseAllowKinds(raw: string | undefined): { images: boolean; videos: boolean } {
  const text = (raw ?? "image,video").trim().toLowerCase();
  if (!text || text === "all") {
    return { images: true, videos: true };
  }
  const tokens = text.split(/[,;\s]+/).map((t) => t.trim()).filter(Boolean);
  return {
    images: tokens.some((t) => t === "image" || t === "images" || t.startsWith("image/")),
    videos: tokens.some((t) => t === "video" || t === "videos" || t.startsWith("video/"))
  };
}

export function getEmailAttachmentConfig(): EmailAttachmentConfig {
  const kinds = parseAllowKinds(process.env.EMAIL_ATTACHMENT_ALLOW);
  return {
    enabled: envFlag(process.env.EMAIL_INGEST_ATTACHMENTS, true),
    maxBytesPerFile: positiveInt(process.env.EMAIL_ATTACHMENT_MAX_BYTES, 8 * 1024 * 1024),
    maxFilesPerEmail: positiveInt(process.env.EMAIL_ATTACHMENT_MAX_COUNT, 8),
    allowImages: kinds.images,
    allowVideos: kinds.videos
  };
}

export function isAllowedAttachmentMime(
  contentType: string,
  config: EmailAttachmentConfig
): boolean {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!mime) return false;
  if (config.allowImages && mime.startsWith("image/")) return true;
  if (config.allowVideos && mime.startsWith("video/")) return true;
  return false;
}
