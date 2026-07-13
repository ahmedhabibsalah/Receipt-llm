const tf = require("@tensorflow/tfjs"); // Pure JS version
const { decodeImage } = require("../lib/image-decode");

// ── Read image and get dimensions ────────────────────────────────────────
function getImageDimensions(imagePath) {
  const decoded = decodeImage(imagePath);
  return { width: decoded.width, height: decoded.height };
}

// ── Crop and convert image to tensor ─────────────────────────────────────
function imageToTensor(imagePath, box) {
  const [x, y, w, h] = box;

  // Decode image to raw pixel data (handles JPEG, JFIF, PNG)
  const decoded = decodeImage(imagePath);
  const { width: imgWidth, height: imgHeight, data } = decoded;

  // Clamp crop coordinates to image bounds
  const cropX = Math.max(0, Math.min(x, imgWidth - 1));
  const cropY = Math.max(0, Math.min(y, imgHeight - 1));
  const cropW = Math.min(w, imgWidth - cropX);
  const cropH = Math.min(h, imgHeight - cropY);

  // Extract the cropped region pixel data (RGB only, skip alpha)
  const rgbData = [];
  for (let row = cropY; row < cropY + cropH; row++) {
    for (let col = cropX; col < cropX + cropW; col++) {
      const i = (row * imgWidth + col) * 4; // RGBA index
      rgbData.push(data[i], data[i + 1], data[i + 2]); // R, G, B
    }
  }

  // Create tensor from cropped RGB data
  let tensor = tf.tensor3d(rgbData, [cropH, cropW, 3], "float32"); // the input for ml

  // Resize to 224×224 using bilinear interpolation
  const resized = tf.image.resizeBilinear(tensor, [224, 224]);

  // Normalize pixel values from [0, 255] to [0, 1]
  const normalized = tf.div(resized, 255.0);

  // Cleanup intermediate tensors
  tensor.dispose();
  resized.dispose();

  return normalized; // Shape: [224, 224, 3], values in [0, 1]
}

// ── Batch convert dataset to tensors ─────────────────────────────────────
function datasetToTensors(examples, imagesDir) {
  console.log(`Converting ${examples.length} examples to tensors...`);

  const tensors = [];
  const labels = [];
  let skipped = 0;

  examples.forEach((ex, index) => {
    const imagePath = require("path").join(imagesDir, ex.image);

    try {
      const tensor = imageToTensor(imagePath, ex.box);
      tensors.push(tensor);
      labels.push(ex.label);

      if ((index + 1) % 50 === 0) {
        console.log(`  Converted ${index + 1}/${examples.length}`);
      }
    } catch (error) {
      console.error(`  ✗ Skipped ${ex.image}: ${error.message}`);
      skipped++;
    }
  });

  if (skipped > 0) {
    console.log(`  ⚠ Skipped ${skipped} images`);
  }

  // Stack all tensors into a single batch
  const xs = tf.stack(tensors);

  // Convert labels to tensor
  const ys = tf.tensor2d(
    labels.map((l) => [l]),
    [labels.length, 1],
    "float32",
  );

  // Cleanup individual tensors
  tensors.forEach((t) => t.dispose());

  console.log(`✓ Tensors created: xs=${xs.shape}, ys=${ys.shape}`);

  return { xs, ys };
}

module.exports = {
  getImageDimensions,
  imageToTensor,
  datasetToTensors,
};
