import { Image, PixelRatio } from "react-native";

/**
 * Cloudinary-aware thumbnail helper. Our product images come from
 * Cloudinary (res.cloudinary.com/dxxzt7k6i/...) and the originals are
 * full-resolution JPEGs — typically 1500-3000px wide at 200-500 KB
 * each. Rendering them at 140×140 inside a horizontal scroll wastes
 * bandwidth and renders slowly, especially on cellular.
 *
 * Cloudinary URL transforms (https://cloudinary.com/documentation/image_transformations)
 * let us request a resized + auto-format + auto-quality variant
 * inline — no API call, no upload, no admin work. f_auto serves
 * WebP / AVIF where the client supports them; q_auto picks the
 * best quality/size balance. c_fill crops to the requested aspect.
 *
 * Typical result: ~200KB JPEG → ~15KB WebP. That's the difference
 * between "image appears immediately" and "image appears 2 seconds
 * later when you've already scrolled past."
 *
 * For non-Cloudinary URLs (e.g. legacy storehub or custom), returns
 * the original URL unchanged.
 */

type ThumbOptions = {
  /** Square thumbnail: logical pixel size of the edge. */
  size?: number;
  /** Non-square: pass width only (Cloudinary keeps aspect ratio when
   *  height is omitted). Useful for full-bleed hero images where the
   *  intrinsic aspect must be preserved. */
  width?: number;
  /** "fill" = crop to requested dimensions, "fit" = letterbox.
   *  Defaults to fill for square thumbs (size:N) and scale for
   *  width-only (preserves aspect). */
  mode?: "fill" | "fit";
};

export function cloudinaryThumb(
  url: string | null | undefined,
  opts: ThumbOptions,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("res.cloudinary.com")) return url;
  if (!url.includes("/image/upload/")) return url;

  // Bump to actual device pixels — RN's PixelRatio.get() returns the
  // logical-to-physical scale (e.g. 3 on iPhone 14 Pro). Cap at 3 to
  // avoid serving 4K thumbs to outlier devices.
  const scale = Math.min(PixelRatio.get(), 3);

  let transform: string;
  if (opts.size !== undefined) {
    const px = Math.round(opts.size * scale);
    const crop = opts.mode === "fit" ? "c_fit" : "c_fill";
    transform = `${crop},w_${px},h_${px},f_auto,q_auto`;
  } else if (opts.width !== undefined) {
    const px = Math.round(opts.width * scale);
    // c_scale keeps the source aspect ratio — only constrains width.
    transform = `c_scale,w_${px},f_auto,q_auto`;
  } else {
    // No size hint → just add format/quality optimisation.
    transform = "f_auto,q_auto";
  }

  return url.replace("/image/upload/", `/image/upload/${transform}/`);
}

/**
 * Fire-and-forget warm-up for an array of image URLs. Call from a
 * useEffect on screens that scroll into product thumbnails — by the
 * time the user reaches the offscreen part of the scroll, those
 * images are already in RN's image cache and render in one frame.
 *
 * Skips undefined entries and swallows per-image errors so one bad
 * URL doesn't block the rest.
 */
export function prefetchImages(urls: Array<string | null | undefined>): void {
  for (const u of urls) {
    if (!u) continue;
    Image.prefetch(u).catch(() => {});
  }
}
