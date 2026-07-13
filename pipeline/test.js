const { runEasyOCR } = require("./ocr");
const { findTotal, extractNumber } = require("./parser");
const path = require("path");
const fs = require("fs");

const IMAGES_DIR = path.join(__dirname, "..", "llm-images");
const LABELS_PATH = path.join(__dirname, "..", "receipt_labels.json");
const labels = JSON.parse(fs.readFileSync(LABELS_PATH, "utf8"));

async function testAll() {
  console.log("Testing parser on all 51 receipts...\n");
  console.log("─────────────────────────────────────────────────");
  let correct = 0;
  let notFound = 0;
  let wrong = 0;
  let total = 0;

  for (const entry of labels) {
    if (!entry.total.length || !entry.total[0].value) continue;
    const imagePath = path.join(IMAGES_DIR, entry.image);
    if (!fs.existsSync(imagePath)) continue;

    total++;
    const blocks = await runEasyOCR(imagePath);
    const result = findTotal(blocks);
    const labeled = entry.total[0].value;

    if (!result) {
      notFound++;
      // Show what numbers OCR actually saw
      const allNumbers = blocks
        .map((b) => extractNumber(b.text))
        .filter((n) => n !== null)
        .sort((a, b) => b - a)
        .slice(0, 3); // top 3 numbers OCR found

      console.log(
        `❌ NOT FOUND  ${entry.image.padEnd(12)} labeled: ${labeled.padEnd(12)} OCR saw: [${allNumbers.join(", ")}]`,
      );
      continue;
    }

    const labeledNum = parseFloat(labeled.replace(/,/g, ""));
    const predictedNum = result.value;
    const diff = Math.abs(labeledNum - predictedNum);
    const pctDiff = (diff / labeledNum) * 100;

    if (pctDiff < 1) {
      correct++;
      console.log(
        `✅ CORRECT    ${entry.image.padEnd(12)} labeled: ${labeled.padEnd(12)} predicted: ${predictedNum} (tier ${result.tier})`,
      );
    } else {
      wrong++;
      console.log(
        `⚠️  WRONG      ${entry.image.padEnd(12)} labeled: ${labeled.padEnd(12)} predicted: ${predictedNum} (tier ${result.tier})`,
      );
    }
  }

  console.log("\n─────────────────────────────────────────────────");
  console.log(`Total:     ${total}`);
  console.log(
    `Correct:   ${correct} (${((correct / total) * 100).toFixed(1)}%)`,
  );
  console.log(`Wrong:     ${wrong}   (${((wrong / total) * 100).toFixed(1)}%)`);
  console.log(
    `Not found: ${notFound} (${((notFound / total) * 100).toFixed(1)}%)`,
  );
  console.log("─────────────────────────────────────────────────");
}

testAll().catch(console.error);
