const tf = require("@tensorflow/tfjs");
const mobilenet = require("@tensorflow-models/mobilenet");
const fs = require("fs");
const path = require("path");
const { imageToTensor, getImageDimensions } = require("./image-utils");

const MODEL_DIR = path.join(__dirname, "saved_model", "receipt_detector");
const POOL_NODE = "module_apply_default/MobilenetV2/Logits/AvgPool";

async function testReceiptDetector(imagePath) {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  RECEIPT DETECTOR TEST");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  // Load MobileNet base
  console.log("Loading MobileNetV2 base...");
  const base = await mobilenet.load({ version: 2, alpha: 1.0 });
  const graphModel = base.model;

  // Load trained head manually
  console.log("Loading trained classifier head...");

  const modelJson = JSON.parse(
    fs.readFileSync(path.join(MODEL_DIR, "model.json"), "utf8"),
  );

  const weightsData = fs.readFileSync(path.join(MODEL_DIR, "weights.bin"));

  const model = await tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: modelJson.modelTopology,
      weightSpecs: modelJson.weightsManifest[0].weights,
      weightData: weightsData.buffer,
    }),
  );

  console.log("✓ Models loaded\n");

  // Process image
  console.log(`Testing image: ${imagePath}\n`);

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

  // Report
  const isReceipt = score > 0.5;

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  RESULT");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  console.log(`Image:      ${path.basename(imagePath)}`);
  console.log(`Score:      ${score.toFixed(4)}`);
  console.log(`Prediction: ${isReceipt ? "✓ RECEIPT" : "✗ NOT A RECEIPT"}`);
  console.log(`Confidence: ${(Math.abs(score - 0.5) * 200).toFixed(1)}%\n`);

  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );
}

// Test on a few images
async function main() {
  const testImages = [
    path.join(__dirname, "..", "llm-images", "1.jpeg"), // Receipt
    path.join(__dirname, "..", "not-receipt", "me.jpg"), // Not receipt
    path.join(__dirname, "..", "llm-images", "46.jpg"), // Receipt
  ];

  for (const img of testImages) {
    if (fs.existsSync(img)) {
      await testReceiptDetector(img);
    }
  }
}

main().catch(console.error);
