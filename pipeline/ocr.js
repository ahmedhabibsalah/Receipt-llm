const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const jpeg = require("jpeg-js");
const { decodeImage } = require("../lib/image-decode");

// ── Call EasyOCR Python script ────────────────────────────────────────────
// Node.js can't run Python directly — we spawn a child process
// spawn() starts a new process, we capture its stdout (the JSON output)
// This is the bridge between your Node.js pipeline and EasyOCR
function runEasyOCR(imagePath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, "ocr_engine.py");

    // spawn python process with image path as argument
    const process = spawn("python", [scriptPath, imagePath]);

    let output = "";
    let errorOutput = "";

    // collect stdout data as it streams in
    process.stdout.on("data", (data) => {
      output += data.toString();
    });

    // collect stderr — EasyOCR prints progress here, not errors
    process.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    // when process finishes parse the JSON output
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`OCR process failed: ${errorOutput}`));
        return;
      }

      try {
        // find the JSON array in output — EasyOCR may print warnings before it
        const jsonStart = output.indexOf("[");
        const jsonEnd = output.lastIndexOf("]") + 1;

        if (jsonStart === -1) {
          reject(new Error("No JSON found in OCR output"));
          return;
        }

        const json = output.slice(jsonStart, jsonEnd);
        const words = JSON.parse(json);
        resolve(words);
      } catch (e) {
        reject(new Error(`Failed to parse OCR output: ${e.message}`));
      }
    });
  });
}

// ── Crop image region ─────────────────────────────────────────────────────
// Crops a region from an image, scales it up for better OCR accuracy
// Used for OCR Pass 2 — reading a tight region around the total
function cropRegion(imagePath, box, scale = 3) {
  const decoded = decodeImage(imagePath);
  const { width, height, data } = decoded;

  const PADDING = 15;
  const [bx, by, bw, bh] = box;
  const cropX = Math.max(0, bx - PADDING);
  const cropY = Math.max(0, by - PADDING);
  const cropW = Math.min(width - cropX, bw + PADDING * 2);
  const cropH = Math.min(height - cropY, bh + PADDING * 2);

  if (cropW <= 0 || cropH <= 0) return null;

  // extract pixels with grayscale + contrast boost
  const rgbData = new Uint8ClampedArray(cropW * cropH * 4);
  for (let row = 0; row < cropH; row++) {
    for (let col = 0; col < cropW; col++) {
      const srcIdx = ((cropY + row) * width + (cropX + col)) * 4;
      const dstIdx = (row * cropW + col) * 4;
      const gray = Math.round(
        data[srcIdx] * 0.299 +
          data[srcIdx + 1] * 0.587 +
          data[srcIdx + 2] * 0.114,
      );
      const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
      rgbData[dstIdx] = boosted;
      rgbData[dstIdx + 1] = boosted;
      rgbData[dstIdx + 2] = boosted;
      rgbData[dstIdx + 3] = 255;
    }
  }

  // scale up for better OCR accuracy on small regions
  const scaledW = cropW * scale;
  const scaledH = cropH * scale;
  const scaledData = new Uint8ClampedArray(scaledW * scaledH * 4);

  for (let row = 0; row < scaledH; row++) {
    for (let col = 0; col < scaledW; col++) {
      const srcIdx =
        (Math.floor(row / scale) * cropW + Math.floor(col / scale)) * 4;
      const dstIdx = (row * scaledW + col) * 4;
      scaledData[dstIdx] = rgbData[srcIdx];
      scaledData[dstIdx + 1] = rgbData[srcIdx + 1];
      scaledData[dstIdx + 2] = rgbData[srcIdx + 2];
      scaledData[dstIdx + 3] = 255;
    }
  }

  const encoded = jpeg.encode(
    { data: Buffer.from(scaledData), width: scaledW, height: scaledH },
    95,
  );
  const tempPath = path.join(__dirname, "..", "temp_crop.jpg");
  fs.writeFileSync(tempPath, encoded.data);

  return tempPath;
}

module.exports = { runEasyOCR, cropRegion };
