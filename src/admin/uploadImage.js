import { API_URL } from "../config";

function authToken() {
  try {
    return JSON.parse(localStorage.getItem("userInfo"))?.token || "";
  } catch {
    return "";
  }
}

/**
 * Upload a single image file to the backend, which stores it in Cloudflare R2
 * and returns a public URL. Throws with a readable message on failure.
 *
 * @param {File} file
 * @param {string} [folder]  logical prefix, e.g. "products" | "categories"
 * @returns {Promise<{ url: string, key: string, sizes?: Record<string,string> }>}
 *          `sizes` maps size names (icon, thumb, small, medium, large, original)
 *          to their public URLs when the server generated responsive variants.
 */
export async function uploadImage(file, folder = "products") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);

  const res = await fetch(`${API_URL}/api/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken()}` }, // no Content-Type — browser sets multipart boundary
    body: fd,
  });

  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

/**
 * Whether R2 uploads are configured on the server. Lets the UI show/hide the
 * uploader and fall back to a URL field when storage isn't set up.
 * @returns {Promise<boolean>}
 */
export async function uploadsEnabled() {
  try {
    const res = await fetch(`${API_URL}/api/uploads/status`, {
      headers: { Authorization: `Bearer ${authToken()}` },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.enabled);
  } catch {
    return false;
  }
}
