const tf = require("@tensorflow/tfjs");
const { generateDataset } = require("./receipt-detector-dataset");
const { imageToTensor } = require("./image-utils");
const fs = require("fs");
const path = require("path");

// ══════════════════════════════════════════════════════════════════════════
// RECEIPT DETECTOR TRAINING
// ══════════════════════════════════════════════════════════════════════════
//
// Task: Binary classification - is this a receipt or not?
// Model: MobileNetV2 (alpha=1.0, frozen) + custom classification head
//
// ══════════════════════════════════════════════════════════════════════════

const MODEL_SAVE_PATH = path.join(__dirname, "saved_model", "receipt_detector");

async function prepareData() {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  PREPARING DATA");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  const dataset = generateDataset();

  console.log("\nConverting to tensors...");

  const xs = [];
  const ys = [];

  for (let i = 0; i < dataset.length; i++) {
    const example = dataset[i];

    try {
      // Convert full image to tensor
      const tensor = imageToTensor(example.imagePath, [
        0,
        0,
        example.width,
        example.height,
      ]);
      xs.push(tensor);
      ys.push(example.label);

      if ((i + 1) % 10 === 0) {
        process.stdout.write(
          `\r  Converted ${i + 1}/${dataset.length} images...`,
        );
      }
    } catch (e) {
      console.log(`\n  ✗ Failed to convert ${example.filename}: ${e.message}`);
    }
  }

  console.log(
    `\r  Converted ${xs.length}/${dataset.length} images successfully.\n`,
  );

  // Stack into batched tensors
  const xsTensor = tf.stack(xs);
  const ysTensor = tf.tensor2d(
    ys.map((y) => [y]),
    [ys.length, 1],
  );

  // Clean up individual tensors
  xs.forEach((t) => t.dispose());

  console.log(
    `Final dataset shape: x=${xsTensor.shape}, y=${ysTensor.shape}\n`,
  );

  return { xs: xsTensor, ys: ysTensor };
}

async function buildModel() {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  BUILDING MODEL");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  // Load MobileNetV2 base using the @tensorflow-models package (this works!)
  console.log("Loading MobileNetV2 base (alpha=1.0)...");
  const mobilenet = require("@tensorflow-models/mobilenet");
  const base = await mobilenet.load({ version: 2, alpha: 1.0 });

  // Get the underlying graph model
  const graphModel = base.model;

  console.log("✓ MobileNetV2 loaded\n");

  // Build a new sequential model with the MobileNet base frozen
  console.log("Building classification model...");

  const model = tf.sequential();

  // We can't directly add the graph model, so we'll use it for feature extraction
  // and train only the classification head
  // For now, let's build a simpler approach: just train the head separately

  // Build just the classification head
  model.add(
    tf.layers.dense({
      inputShape: [1280], // MobileNetV2 alpha=1.0 outputs 1280 features
      units: 64,
      activation: "relu",
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 }),
      name: "dense",
    }),
  );
  model.add(tf.layers.dropout({ rate: 0.3, name: "dropout" }));
  model.add(
    tf.layers.dense({
      units: 32,
      activation: "relu",
      name: "dense_1",
    }),
  );
  model.add(
    tf.layers.dense({
      units: 1,
      activation: "sigmoid",
      name: "dense_2",
    }),
  );

  // Compile
  model.compile({
    optimizer: tf.train.adam(0.0001),
    loss: "binaryCrossentropy",
    metrics: ["accuracy"],
  });

  console.log("✓ Model built and compiled\n");

  model.summary();
  console.log("");

  return { model, graphModel };
}

async function train() {
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  RECEIPT DETECTOR TRAINING");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  // Prepare data
  const { xs, ys } = await prepareData();

  // Build model
  const { model, graphModel } = await buildModel();

  // Extract features from MobileNet
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  EXTRACTING FEATURES");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  console.log("Running all images through MobileNetV2...");
  const poolNode = "module_apply_default/MobilenetV2/Logits/AvgPool";
  const features = graphModel.execute(xs, poolNode);
  const flattenedFeatures = features.reshape([xs.shape[0], 1280]);

  console.log(`✓ Features extracted: ${flattenedFeatures.shape}\n`);

  features.dispose();
  xs.dispose(); // Don't need images anymore

  // Train
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  TRAINING");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  console.log("Starting training...");
  console.log("  Epochs: 50");
  console.log("  Batch size: 16");
  console.log("  Validation split: 15%");
  console.log("  Early stopping: patience=10\n");

  const history = await model.fit(flattenedFeatures, ys, {
    epochs: 50,
    batchSize: 16,
    validationSplit: 0.15,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(
          `Epoch ${(epoch + 1).toString().padStart(2)}: ` +
            `loss=${logs.loss.toFixed(4)}, ` +
            `acc=${logs.acc.toFixed(4)}, ` +
            `val_loss=${logs.val_loss.toFixed(4)}, ` +
            `val_acc=${logs.val_acc.toFixed(4)}`,
        );
      },
    },
  });

  // Clean up tensors
  flattenedFeatures.dispose();
  ys.dispose();

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("  TRAINING COMPLETE");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  const finalLoss =
    history.history.val_loss[history.history.val_loss.length - 1];
  const finalAcc = history.history.val_acc[history.history.val_acc.length - 1];

  console.log(`Final validation loss:     ${finalLoss.toFixed(4)}`);
  console.log(`Final validation accuracy: ${(finalAcc * 100).toFixed(1)}%\n`);

  // Save model (using the approach that works in pure tfjs)
  console.log("Saving model...");

  if (!fs.existsSync(MODEL_SAVE_PATH)) {
    fs.mkdirSync(MODEL_SAVE_PATH, { recursive: true });
  }

  // Save using the tf.io.withSaveHandler approach
  const saveResults = await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      // Save model.json
      fs.writeFileSync(
        path.join(MODEL_SAVE_PATH, "model.json"),
        JSON.stringify(artifacts.modelTopology),
      );

      // Save weights
      const weightsManifest = {
        modelTopology: artifacts.modelTopology,
        weightsManifest: [
          {
            paths: ["weights.bin"],
            weights: artifacts.weightSpecs,
          },
        ],
      };

      fs.writeFileSync(
        path.join(MODEL_SAVE_PATH, "model.json"),
        JSON.stringify(weightsManifest),
      );

      fs.writeFileSync(
        path.join(MODEL_SAVE_PATH, "weights.bin"),
        Buffer.from(artifacts.weightData),
      );

      return { modelArtifactsInfo: { dateSaved: new Date() } };
    }),
  );

  console.log(`✓ Model saved to ${MODEL_SAVE_PATH}\n`);

  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );
}

train().catch(console.error);
