const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const tf = require("@tensorflow/tfjs");
const mobilenet = require("@tensorflow-models/mobilenet");
const { imageToTensor, getImageDimensions } = require("../ml/image-utils");
const { runEasyOCR } = require("../pipeline/ocr");
const { findTotal } = require("../pipeline/parser");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.static(path.join(__dirname)));

// ══════════════════════════════════════════════════════════════════════════
// RECEIPT VALIDATOR ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

const DETECTOR_MODEL_DIR = path.join(
  __dirname,
  "..",
  "ml",
  "saved_model",
  "receipt_detector",
);
const POOL_NODE = "module_apply_default/MobilenetV2/Logits/AvgPool";

let validatorCache = null;

async function loadValidator() {
  if (validatorCache) return validatorCache;

  console.log("Loading receipt validator...");

  // Load MobileNet base
  const base = await mobilenet.load({ version: 2, alpha: 1.0 });
  const graphModel = base.model;

  // Load trained head
  const modelJson = JSON.parse(
    fs.readFileSync(path.join(DETECTOR_MODEL_DIR, "model.json"), "utf8"),
  );
  const weightsData = fs.readFileSync(
    path.join(DETECTOR_MODEL_DIR, "weights.bin"),
  );

  const model = await tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest[0].weights,
      weightData: weightsData.buffer,
    }),
  );

  validatorCache = { graphModel, model };
  console.log("✓ Validator loaded");

  return validatorCache;
}

app.post("/api/validate", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);

    // Rename file to include extension (needed for image decoder)
    const imagePath = uploadedPath + ext;
    fs.renameSync(uploadedPath, imagePath);

    // Load models
    const { graphModel, model } = await loadValidator();

    // Process image
    const { width, height } = getImageDimensions(imagePath);
    const tensor = imageToTensor(imagePath, [0, 0, width, height]);

    // Extract features
    const input = tensor.expandDims(0);
    const features = graphModel.execute(input, POOL_NODE);
    const flattened = features.reshape([1, 1280]);

    // Predict
    const prediction = model.predict(flattened);
    const score = (await prediction.data())[0];

    // Cleanup
    tensor.dispose();
    input.dispose();
    features.dispose();
    flattened.dispose();
    prediction.dispose();

    // Delete uploaded file
    fs.unlinkSync(imagePath);

    const elapsed = Date.now() - startTime;

    res.json({
      isReceipt: score > 0.5,
      confidence: score,
      processingTime: elapsed,
    });
  } catch (error) {
    console.error("Validation error:", error);

    // Clean up on error
    try {
      if (req.file && req.file.path) {
        const uploadedPath = req.file.path;
        const originalName = req.file.originalname;
        const ext = path.extname(originalName);
        const imagePath = uploadedPath + ext;

        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// TOTAL EXTRACTION ENDPOINT
// ══════════════════════════════════════════════════════════════════════════

app.post("/api/extract", upload.single("image"), async (req, res) => {
  const startTime = Date.now();

  try {
    const uploadedPath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName);

    // Rename file to include extension
    const imagePath = uploadedPath + ext;
    fs.renameSync(uploadedPath, imagePath);

    // Run OCR
    const blocks = await runEasyOCR(imagePath);

    // Parse total
    const result = findTotal(blocks);

    // Delete uploaded file
    fs.unlinkSync(imagePath);

    const elapsed = Date.now() - startTime;

    if (result && result.value) {
      res.json({
        success: true,
        total: result.value,
        rawText: result.rawText,
        confidence: result.confidence,
        region: null,
        processingTime: elapsed,
      });
    } else {
      res.json({
        success: false,
        error: "Could not extract total from receipt",
        processingTime: elapsed,
      });
    }
  } catch (error) {
    console.error("Extraction error:", error);

    // Clean up on error
    try {
      if (req.file && req.file.path) {
        const uploadedPath = req.file.path;
        const originalName = req.file.originalname;
        const ext = path.extname(originalName);
        const imagePath = uploadedPath + ext;

        if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
        if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════════════════════════════════════

const PORT = 3000;

app.listen(PORT, async () => {
  console.log(
    `\n═══════════════════════════════════════════════════════════════`,
  );
  console.log(`  Receipt Analyzer Demo Server`);
  console.log(
    `═══════════════════════════════════════════════════════════════\n`,
  );
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  Open http://localhost:${PORT} in your browser\n`);

  // Preload models
  console.log("Preloading models...");
  await loadValidator();
  console.log("✓ Ready to accept requests\n");
  console.log(
    `═══════════════════════════════════════════════════════════════\n`,
  );
});

