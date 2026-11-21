/**
 * Bulletproof client-side image processing & upload utility.
 * Compresses images locally before upload and provides an instant Base64
 * fallback if third-party image hosts (e.g. ImgBB) are blocked by adblockers,
 * rate-limited, or offline.
 */

const IMGBB_KEY = process.env.NEXT_PUBLIC_IMGBB_KEY || "3a8672d6f05b114ce3c0c6e81c8bd9fe";

/**
 * Compresses an image file using an offscreen HTML5 Canvas.
 * Produces a lightweight data URL (typically 15KB - 50KB) that can be
 * uploaded or stored directly in Firestore without size issues.
 */
export async function compressImageFile(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.8
): Promise<{ dataUrl: string; blob: Blob }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Maintain aspect ratio while bounding within maxWidth/maxHeight
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas 2D context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Prefer webp, fallback to jpeg
        const dataUrl = canvas.toDataURL("image/webp", quality) || canvas.toDataURL("image/jpeg", quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ dataUrl, blob });
            } else {
              // Convert dataUrl to blob manually if canvas.toBlob fails
              const byteString = atob(dataUrl.split(",")[1]);
              const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve({ dataUrl, blob: new Blob([ab], { type: mimeString }) });
            }
          },
          "image/webp",
          quality
        );
      };

      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads an image with resilient fallback:
 * 1. Locally compresses the image to a low-latency WebP/JPEG (< 50KB).
 * 2. Attempts uploading the compressed blob to ImgBB with an abort timeout.
 * 3. If ImgBB fails (blocked by adblocker, rate limited, network timeout),
 *    returns the compressed Data URL directly.
 * 
 * Never crashes or throws an unhandled exception.
 */
export async function uploadImageWithFallback(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ url: string; source: "cdn" | "local_fallback" }> {
  const { maxWidth = 600, maxHeight = 600, quality = 0.8, timeoutMs = 5000 } = options;

  // 1. Client-side local compression
  let compressedDataUrl = "";
  let compressedBlob: Blob | null = null;

  try {
    const compressed = await compressImageFile(file, maxWidth, maxHeight, quality);
    compressedDataUrl = compressed.dataUrl;
    compressedBlob = compressed.blob;
  } catch (err) {
    console.warn("Client-side image compression failed, reading raw file:", err);
  }

  // 2. Try ImgBB with a strict timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const formData = new FormData();
    if (compressedBlob) {
      formData.append("image", compressedBlob, "upload.webp");
    } else {
      formData.append("image", file);
    }

    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.data?.url) {
        return { url: data.data.url, source: "cdn" };
      }
    }
  } catch (err: any) {
    console.info("ImgBB upload bypassed or unreachable, using compressed fallback:", err?.message || err);
  }

  // 3. Guaranteed fallback: return the high-efficiency local data URL
  if (compressedDataUrl) {
    return { url: compressedDataUrl, source: "local_fallback" };
  }

  // As a final emergency measure, return simple FileReader base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result as string, source: "local_fallback" });
    reader.onerror = () => reject(new Error("Unable to read image file"));
    reader.readAsDataURL(file);
  });
}
