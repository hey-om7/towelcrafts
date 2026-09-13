import { useEffect, useRef, useState } from "react";
import { FaCloudUploadAlt, FaLink, FaSpinner, FaTimes } from "react-icons/fa";
import { imageUrl } from "../config";
import { uploadImage, uploadsEnabled } from "./uploadImage";

/**
 * Image field with drag/click upload to Cloudflare R2 plus a URL fallback.
 *
 * Controlled: the stored image value is `value` and changes flow through
 * `onChange(newValue)`. The value is whatever should be persisted — a full R2
 * URL after upload, or a manually entered URL/path.
 *
 * @param {Object}   props
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.folder]   R2 folder prefix (default "products")
 * @param {string}   [props.label]    field label
 * @param {boolean}  [props.required]
 */
export function ImageUploader({ value, onChange, folder = "products", label = "Image", required = false }) {
  const [enabled, setEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [showUrlField, setShowUrlField] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let alive = true;
    uploadsEnabled().then((ok) => {
      if (!alive) return;
      setEnabled(ok);
      // When R2 isn't configured, default to the manual URL field.
      if (!ok) setShowUrlField(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const handleFiles = async (fileList) => {
    const file = fileList && fileList[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file, folder);
      setLoadFailed(false);
      onChange(url);
    } catch (e) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const resolved = imageUrl(value);

  return (
    <div className="uploader">
      <div className="uploader__head">
        <label className="admin__form-label">
          {label}
          {required ? " *" : ""}
        </label>
        {enabled && (
          <button
            type="button"
            className="uploader__toggle"
            onClick={() => setShowUrlField((s) => !s)}
          >
            <FaLink /> {showUrlField ? "Use upload" : "Enter URL instead"}
          </button>
        )}
      </div>

      {!showUrlField && enabled && (
        <div
          className={`uploader__drop${dragging ? " uploader__drop--active" : ""}${uploading ? " uploader__drop--busy" : ""}`}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !uploading) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          aria-label="Upload image"
        >
          {uploading ? (
            <span className="uploader__drop-inner">
              <FaSpinner className="uploader__spin" /> Uploading…
            </span>
          ) : (
            <span className="uploader__drop-inner">
              <FaCloudUploadAlt className="uploader__icon" />
              <span>
                <strong>Click to upload</strong> or drag an image here
              </span>
              <span className="uploader__hint">JPEG, PNG, WebP, AVIF or SVG · up to 8 MB</span>
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {showUrlField && (
        <input
          type="text"
          className="admin__form-input"
          value={value || ""}
          onChange={(e) => {
            setLoadFailed(false);
            onChange(e.target.value);
          }}
          placeholder="https://cdn.example.com/image.webp or /image.png"
        />
      )}

      {error && <p className="admin__image-preview-error">{error}</p>}

      {value ? (
        loadFailed ? (
          <p className="admin__image-preview-error">Image could not be loaded. Check the URL or re-upload.</p>
        ) : (
          <div className="uploader__preview">
            <div className="admin__image-preview">
              <img src={resolved} alt="Preview" onError={() => setLoadFailed(true)} />
            </div>
            <button
              type="button"
              className="uploader__remove"
              onClick={() => {
                setLoadFailed(false);
                onChange("");
              }}
            >
              <FaTimes /> Remove
            </button>
          </div>
        )
      ) : (
        !showUrlField && !uploading && <p className="admin__image-preview-hint">No image selected yet.</p>
      )}
    </div>
  );
}
