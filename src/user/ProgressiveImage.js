import { useEffect, useRef, useState } from "react";
import { imageUrl, imageUrlSized, imageSrcSet } from "../config";
import "./ProgressiveImage.css";

/**
 * Blur-up (LQIP) image loader.
 *
 * Immediately paints a tiny, blurred placeholder variant (thumb → icon) while
 * the full-quality image downloads, then cross-fades to the sharp image once it
 * has loaded. Works with the responsive `imageSizes` map produced on upload and
 * degrades gracefully when only a single `image` string is available.
 *
 * The component fills its parent, so wrap it in an element that owns the
 * aspect-ratio / border-radius / overflow (the existing card image containers
 * already do). Hover transforms defined on the container still apply to the
 * rendered <img> via the shared `pimg__full` class.
 *
 * @param {Object} props
 * @param {Object|string} props.item        product/category object, or raw value
 * @param {string} props.alt
 * @param {string} [props.size='medium']    which variant the full image targets
 * @param {string} [props.sizes]            responsive `sizes` attribute
 * @param {string} [props.placeholder='thumb']  variant used for the blurred LQIP
 * @param {'lazy'|'eager'} [props.loading='lazy']
 * @param {string} [props.className]        extra class on the wrapper
 */
export function ProgressiveImage({
  item,
  alt = "",
  size = "medium",
  sizes,
  placeholder = "thumb",
  loading = "lazy",
  className = "",
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const imgRef = useRef(null);

  const full = imageUrlSized(item, size);
  const srcSet = imageSrcSet(item);
  // Prefer a genuine small variant for the blur; fall back to the full image
  // (still fine — it just downloads once) when no size map exists.
  const lqip =
    (item && typeof item === "object" && item.imageSizes
      ? imageUrlSized(item, placeholder)
      : "") || full;

  // If the full image is already cached, it may be `complete` before React
  // attaches an onLoad handler — detect that on mount so we don't stay blurred.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [full]);

  if (!full) {
    return <div className={`pimg pimg--empty ${className}`.trim()} aria-hidden="true" />;
  }

  const hasLqip = lqip && lqip !== full;

  return (
    <div className={`pimg ${className}`.trim()}>
      {hasLqip && (
        <img
          className={`pimg__lqip${loaded && !errored ? " pimg__lqip--hidden" : ""}`}
          src={imageUrl(lqip)}
          alt=""
          aria-hidden="true"
          draggable="false"
        />
      )}
      <img
        ref={imgRef}
        className={`pimg__full${loaded && !errored ? " pimg__full--loaded" : ""}`}
        src={full}
        srcSet={srcSet || undefined}
        sizes={srcSet && sizes ? sizes : undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setErrored(true)}
      />
    </div>
  );
}
