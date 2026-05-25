/**
 * TRACE — Photo Processing Service
 *
 * Handles EXIF extraction and sanitization for sighting photos.
 * PRESERVES: GPS coordinates, timestamp
 * STRIPS: device info, camera model, software, serial numbers
 *
 * Also handles thumbnail generation for Vault A
 * while full-res goes to Vault C (evidence locker).
 */
import exifr from "exifr";
import sharp from "sharp";

export type ExtractedExif = {
  lat: number | null;
  lng: number | null;
  timestamp: Date | null;
};

/**
 * Extract GPS and timestamp from photo EXIF.
 * All other EXIF data is discarded (device fingerprinting protection).
 */
export async function extractSafeExif(photoBuffer: Buffer): Promise<ExtractedExif> {
  try {
    const exif = await exifr.parse(photoBuffer, {
      gps: true,
      pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude"],
    });

    return {
      lat: exif?.latitude ?? null,
      lng: exif?.longitude ?? null,
      timestamp: exif?.DateTimeOriginal ?? exif?.CreateDate ?? null,
    };
  } catch {
    return { lat: null, lng: null, timestamp: null };
  }
}

/**
 * Strip ALL EXIF from a photo buffer.
 * Returns a clean buffer with no metadata (device fingerprinting protection).
 * GPS and timestamp are extracted separately BEFORE stripping.
 */
export async function stripExif(photoBuffer: Buffer): Promise<Buffer> {
  return sharp(photoBuffer)
    .rotate()         // auto-rotate based on EXIF orientation before stripping
    .withMetadata({}) // empty metadata = strip everything
    .toBuffer();
}

/**
 * Generate a thumbnail for the operator dashboard.
 * Stored in Vault A (operational). Full-res stays in Vault C (evidence).
 */
export async function generateThumbnail(
  photoBuffer: Buffer,
  maxWidth = 400
): Promise<Buffer> {
  return sharp(photoBuffer)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .withMetadata({}) // no EXIF in thumbnails either
    .toBuffer();
}

/**
 * Process a sighting photo end-to-end:
 * 1. Extract GPS + timestamp from EXIF
 * 2. Strip all EXIF from original
 * 3. Generate thumbnail
 * Returns everything needed for Vault A (thumbnail) and Vault C (clean full-res).
 */
export async function processPhoto(photoBuffer: Buffer): Promise<{
  exif: ExtractedExif;
  cleanFullRes: Buffer;
  thumbnail: Buffer;
}> {
  const [exif, cleanFullRes, thumbnail] = await Promise.all([
    extractSafeExif(photoBuffer),
    stripExif(photoBuffer),
    generateThumbnail(photoBuffer),
  ]);

  return { exif, cleanFullRes, thumbnail };
}
