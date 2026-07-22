const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_IMAGES_PER_PICKUP = 5;

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Validates a single uploaded image file (type + size) before it is
 * sent to Cloudinary.
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type}". Allowed: JPEG, PNG, WEBP.`,
    };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File "${file.name}" exceeds the 5MB size limit.`,
    };
  }
  if (file.size === 0) {
    return { valid: false, error: `File "${file.name}" is empty.` };
  }
  return { valid: true };
}

/**
 * Validates the full batch of files in a single upload request.
 */
export function validateImageBatch(
  files: File[],
  existingCount: number
): ImageValidationResult {
  if (files.length === 0) {
    return { valid: false, error: "No files provided." };
  }
  if (existingCount + files.length > MAX_IMAGES_PER_PICKUP) {
    return {
      valid: false,
      error: `A pickup request may have at most ${MAX_IMAGES_PER_PICKUP} images (already has ${existingCount}).`,
    };
  }
  for (const file of files) {
    const result = validateImageFile(file);
    if (!result.valid) return result;
  }
  return { valid: true };
}
