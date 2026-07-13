const fs = require("fs");
const jpeg = require("jpeg-js");
const { PNG } = require("pngjs");

// Decodes JPEG or PNG → { width, height, data } where data is a Uint8Array of RGBA pixels.
// Drop-in replacement for `jpeg.decode(buffer, { useTArray: true })`.
// PNG transparency is composited onto a white background (suitable for receipts).
function decodeImage(imagePath) {
  const ext = imagePath.toLowerCase().split(".").pop();
  const buffer = fs.readFileSync(imagePath);

  if (ext === "jpg" || ext === "jpeg" || ext === "jfif") {
    return jpeg.decode(buffer, { useTArray: true });
  }

  if (ext === "png") {
    const png = PNG.sync.read(buffer);
    const { width, height, data } = png; // data is Buffer of RGBA, length = w*h*4

    // Composite alpha onto white. For each pixel:
    //   out_rgb = src_rgb * alpha + white * (1 - alpha)
    // alpha is 0..255; after compositing we set alpha=255.
    const out = new Uint8Array(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255;
      out[i] = Math.round(data[i] * a + 255 * (1 - a));
      out[i + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      out[i + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
      out[i + 3] = 255;
    }
    return { width, height, data: out };
  }

  throw new Error(`Unsupported image format: .${ext} (${imagePath})`);
}

module.exports = { decodeImage };
