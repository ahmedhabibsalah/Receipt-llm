const { generateDataset } = require("./receipt-detector-dataset");
const { imageToTensor } = require("./image-utils");

// ══════════════════════════════════════════════════════════════════════════
// TEST: Convert dataset to tensors
// ══════════════════════════════════════════════════════════════════════════

function testTensorConversion() {
  console.log("Generating dataset...\n");
  const dataset = generateDataset();

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("  TESTING TENSOR CONVERSION");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  let successCount = 0;
  let failCount = 0;
  const failures = [];

  console.log("Converting images to tensors (this may take a minute)...\n");

  for (let i = 0; i < dataset.length; i++) {
    const example = dataset[i];

    try {
      // Try to convert the full image to a tensor
      // For receipt detection, we use the whole image (no box crop)
      const tensor = imageToTensor(example.imagePath, [
        0,
        0,
        example.width,
        example.height,
      ]);

      // Verify tensor shape
      const shape = tensor.shape;
      if (shape[0] !== 224 || shape[1] !== 224 || shape[2] !== 3) {
        throw new Error(`Invalid tensor shape: [${shape.join(", ")}]`);
      }

      tensor.dispose(); // Clean up
      successCount++;

      if ((i + 1) % 10 === 0) {
        process.stdout.write(
          `\r  Processed ${i + 1}/${dataset.length} images...`,
        );
      }
    } catch (e) {
      failCount++;
      failures.push({
        filename: example.filename,
        error: e.message,
      });
    }
  }

  console.log(
    `\r  Processed ${dataset.length}/${dataset.length} images.     \n`,
  );

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("  RESULTS");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  console.log(
    `Success: ${successCount}/${dataset.length} (${((successCount / dataset.length) * 100).toFixed(1)}%)`,
  );
  console.log(`Failed:  ${failCount}/${dataset.length}\n`);

  if (failures.length > 0) {
    console.log("Failed images:");
    failures.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.filename}: ${f.error}`);
    });
    console.log("");
  }

  if (successCount === dataset.length) {
    console.log("✓ All images converted successfully!");
    console.log("  Ready to proceed to training.\n");
    return true;
  } else if (successCount >= dataset.length * 0.95) {
    console.log("⚠️  Some images failed, but we have 95%+ success rate.");
    console.log("   We can proceed with training on the successful images.\n");
    return true;
  } else {
    console.log("✗ Too many failures. Need to investigate image issues.\n");
    return false;
  }
}

const success = testTensorConversion();
process.exit(success ? 0 : 1);
