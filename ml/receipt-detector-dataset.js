const fs = require("fs");
const path = require("path");
const { getImageDimensions } = require("./image-utils");

// ══════════════════════════════════════════════════════════════════════════
// RECEIPT DETECTION DATASET GENERATOR
// ══════════════════════════════════════════════════════════════════════════
//
// Task: Binary classification - is this image a receipt or not?
//
// Positive examples: Full receipt images from llm-images/
// Negative examples: Non-receipt images from not-receipt/
//
// Output: List of {imagePath, label} where label = 1 (receipt) or 0 (not receipt)
//
// ══════════════════════════════════════════════════════════════════════════

const RECEIPT_DIR = path.join(__dirname, "..", "llm-images");
const NON_RECEIPT_DIR = path.join(__dirname, "..", "not-receipt");

function generateDataset() {
  const examples = [];

  console.log("Scanning receipt images...");
  const receiptFiles = fs.readdirSync(RECEIPT_DIR);

  for (const file of receiptFiles) {
    const ext = file.toLowerCase().split(".").pop();

    // Skip non-image files
    if (!["jpeg", "jpg", "jfif", "png", "webp"].includes(ext)) {
      console.log(`  Skipping ${file} (not an image)`);
      continue;
    }

    const imagePath = path.join(RECEIPT_DIR, file);

    // Try to read dimensions to verify it's a valid image
    try {
      const { width, height } = getImageDimensions(imagePath);
      examples.push({
        imagePath,
        label: 1, // Receipt
        filename: file,
        width,
        height,
      });
      console.log(`  ✓ ${file} (${width}x${height})`);
    } catch (e) {
      console.log(`  ✗ ${file} - Failed to read: ${e.message}`);
    }
  }

  console.log(`\nScanning non-receipt images...`);
  const nonReceiptFiles = fs.readdirSync(NON_RECEIPT_DIR);

  for (const file of nonReceiptFiles) {
    const ext = file.toLowerCase().split(".").pop();

    // Skip non-image files
    if (!["jpeg", "jpg", "jfif", "png", "webp"].includes(ext)) {
      console.log(`  Skipping ${file} (not an image)`);
      continue;
    }

    const imagePath = path.join(NON_RECEIPT_DIR, file);

    // Try to read dimensions to verify it's a valid image
    try {
      const { width, height } = getImageDimensions(imagePath);
      examples.push({
        imagePath,
        label: 0, // Not receipt
        filename: file,
        width,
        height,
      });
      console.log(`  ✓ ${file} (${width}x${height})`);
    } catch (e) {
      console.log(`  ✗ ${file} - Failed to read: ${e.message}`);
    }
  }

  // Shuffle the dataset
  for (let i = examples.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [examples[i], examples[j]] = [examples[j], examples[i]];
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════",
  );
  console.log("  DATASET SUMMARY");
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  const receipts = examples.filter((e) => e.label === 1);
  const nonReceipts = examples.filter((e) => e.label === 0);

  console.log(`Total examples:     ${examples.length}`);
  console.log(`  Receipts:         ${receipts.length}`);
  console.log(`  Non-receipts:     ${nonReceipts.length}`);
  console.log(
    `\nClass balance:      ${((receipts.length / examples.length) * 100).toFixed(1)}% receipts`,
  );

  if (Math.abs(receipts.length - nonReceipts.length) > 10) {
    console.log(`\n⚠️  WARNING: Classes are imbalanced!`);
    console.log(
      `   Consider adding more ${receipts.length > nonReceipts.length ? "non-receipt" : "receipt"} images.`,
    );
  } else {
    console.log(`\n✓ Classes are well balanced`);
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════════\n",
  );

  return examples;
}

// Test the dataset generation
function main() {
  const dataset = generateDataset();

  // Show first 5 of each class as examples
  console.log("First 5 receipt examples:");
  dataset
    .filter((e) => e.label === 1)
    .slice(0, 5)
    .forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.filename} (${e.width}x${e.height})`);
    });

  console.log("\nFirst 5 non-receipt examples:");
  dataset
    .filter((e) => e.label === 0)
    .slice(0, 5)
    .forEach((e, i) => {
      console.log(`  ${i + 1}. ${e.filename} (${e.width}x${e.height})`);
    });

  console.log(`\n✓ Dataset generation looks good!`);
  console.log(`  Ready to proceed to training.\n`);
}

main();

module.exports = { generateDataset };
