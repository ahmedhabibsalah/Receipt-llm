// ── Keyword dictionaries ──────────────────────────────────────────────────
// Built from real receipt analysis across 51 receipts
// covering English, Arabic, French, Hungarian receipt formats

const KEYWORDS = {
  // tier 1 — unambiguous final total keywords
  // these almost always mean the grand total, not a subtotal
  tier1: [
    // English variants
    "grand total",
    "total due",
    "final total",
    "amount due",
    "total payable",
    "balance due",
    "net amount",
    "total amount",
    "amount charged", // digital invoices (21.jpeg)
    "invoice total", // retail receipts (2.jpeg)
    "g. total",
    "g.total",
    "g total", // **ADD THIS**
    "gtotal", // **ADD THIS**
    "total egp",
    // Arabic variants — covering regional differences
    "الإجمالي",
    "اجمالي",
    "الاجمالي",
    "اجمالى", // alternate spelling (47.jpeg)
    "المجموع",
    "الصافي",
    "صافي المطنوب", // pharmacy receipts (32.jpeg)
    "صافي المدفوع", // payment receipts
    "المبلغ الإجمالي",
    "إجمالي المبلغ",
    "المبلغ الكلي", // Fawry receipts (4.jpeg)
    "المبلغ الاجمالي",

    // French variants (54.jpg Le Cafe Marly)
    "total", // French receipts often just say TOTAL in large text
    "montant total",
    "montant dû",
    "total duo",
    // Hungarian variants (5.jpeg Cucina)
    "összesen",
    "osszesen",
    "végösszeg",
  ],

  // tier 2 — likely total but need context
  // "total" alone can be a column header so we validate by position
  tier2: [
    "total",
    "amount",
    "المبلغ",
    "يجب دفعه",
    "total due", // duplicate coverage

    "usd",
    "egp",
    "eur",
    "gbp",
  ],

  // blacklist — never the final total
  // always subtotals, fees, column headers, or item counts
  blacklist: [
    "subtotal",
    "sub total",
    "sub-total",
    "sub_total",
    "delivery fee",
    "delivery",
    "service fee",
    "service charge",
    "service",
    "discount",
    "disc",
    "vat",
    "tax",
    "taxes",
    "total taxes", // 35.webp "Total Taxes $6.92"
    "items total",
    "total items",
    "total no. of items", // 42.jpg "Total no. of items 6"
    "no. of items",
    "products count", // 33.jpg "Products Count 5"
    "merchandise",
    "qty",
    "quantity",
    "item",
    "price",
    "description",
    "net price", // 45.jpg "Net Price" is not the total
    "اجمالي المواد",
    "مجموع العناصر",
    "إجمالي الأصناف", // 32.jpeg pharmacy items total
    "إجمالي الكمية",
    "ضريبة",
    "خصم",
    "رسوم",
    "change", // 42.jpg "Change 2.00" is not the total
    "cash",
    "tendered",
    "payment",
  ],
};

// ── Clean raw text to extract numeric value ───────────────────────────────
// Handles: "EGP 545.99", "٤GP 140.00", "$93.42", "DL: 498.000",
//          "1.051,00" (European), "2.215.25" (double dot), "٥٥,٩٩"
//          "11, 599, 00" (spaces in number), "E6P 560.00" (OCR errors)

function extractNumber(text) {
  // step 1 — strip currency codes and common suffixes BEFORE converting Arabic numeral
  let cleaned = text;

  // **FIX for 35.webp: Space as decimal (digit space 2-digits at end)**
  if (/\d\s\d{2}(?!\d)/.test(text)) {
    cleaned = text.replace(/(\d)\s(\d{2})(?!\d)/, "$1.$2");
  }

  // **FIX for 18.jpeg: Handle ".XX. XX" pattern**
  // ".53. 28" should become "53.28"
  if (/^\.\d{2}\.\s*\d{2}/.test(text)) {
    cleaned = text.replace(/^\.(\d{2})\.\s*(\d{2})/, "$1.$2");
  }

  cleaned = cleaned
    .replace(/\[.*?\]/g, "") // strip brackets e.g. "Total [24]"
    .replace(/\s+/g, "") // **FIX 1: remove ALL whitespace** - handles "11, 599, 00"
    .replace(/[٤]?[Gg][Pp]/g, "") // ٤GP, EGP, 4GP, egp variants
    .replace(/[E٤e][0-9]?[Gg]?[Pp]/gi, "") // **FIX 2: E6P, E1P OCR errors**
    .replace(/[A-Z]{2,4}(?!\d)/g, "") // USD, SAR, AED, EUR, GBP, EGP etc (but not if followed by digit)
    .replace(/DL\s*:\s*/gi, "") // "DL: 498.000" (Syrian pound)
    .replace(/ج\.?م\.?/g, "") // ج.م Egyptian pound Arabic
    .replace(/ل\.?[ةه]\.?/g, "") // ل.ه variants
    .replace(/LEs?/gi, "") // LE, LEs Egyptian pound
    .replace(/\/month/gi, "") // **FIX 3: strip "/month"**
    .replace(/[:-]\s*$/g, "") // trailing colons/dashes
    .replace(/\$/g, "") // dollar sign
    .trim();

  // **FIX 4: Handle OCR errors before Arabic conversion**
  // 'o' or 'O' followed by Arabic or Western digit is probably ٥ (5)
  cleaned = cleaned.replace(/0u/g, "1");

  cleaned = cleaned.replace(/[oO](?=[٠-٩\d])/g, "٥");
  // step 2 — convert Arabic-Indic numerals to Western
  const arabicToWestern = (str) =>
    str.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

  cleaned = arabicToWestern(cleaned);

  // **FIX 5: Strip leading dots** - handles ".53.28"
  cleaned = cleaned.replace(/^\.+/, "");

  // step 3 — handle European number formats
  // step 3 — handle European number formats
  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 1) {
    const parts = cleaned.split(".");
    const last = parts.pop();
    cleaned = parts.join("") + "." + last;
  } else if (dotCount === 1 && commaCount === 1) {
    const dotPos = cleaned.indexOf(".");
    const commaPos = cleaned.indexOf(",");
    if (commaPos < dotPos) {
      cleaned = cleaned.replace(/,/g, "");
    } else {
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    }
  } else if (commaCount === 1 && dotCount === 0) {
    // "55,99" → comma is decimal
    cleaned = cleaned.replace(",", ".");
  } else if (commaCount > 1) {
    // **FIX: multiple commas - LAST one is decimal, rest are thousands**
    // "11,599,00" → "11599.00"
    const parts = cleaned.split(",");
    const last = parts.pop();
    cleaned = parts.join("") + "." + last;
  }

  // step 4 — keep only digits and single decimal point
  cleaned = cleaned.replace(/[^\d.]/g, "").trim();
  cleaned = cleaned.replace(/^\.+|\.+$/g, ""); // trim leading/trailing dots (again for safety)

  if (!cleaned) return null;

  const result = parseFloat(cleaned);

  // sanity check — receipt totals should be between 0.01 and 9,999,999
  if (isNaN(result) || result <= 0 || result > 9999999) return null;

  return result;
}
// ── Check keyword tier ────────────────────────────────────────────────────
// ── Check keyword tier ────────────────────────────────────────────────────
function getKeywordTier(text) {
  // **FIX: Handle common OCR character errors in keywords**
  // Must do this BEFORE lowercase normalization
  let fixed = text
    .replace(/T0TAL/gi, "TOTAL") // T0TAL → TOTAL (5.jpeg)
    .replace(/AM0UNT/gi, "AMOUNT") // AM0UNT → AMOUNT
    .replace(/F1NAL/gi, "FINAL") // F1NAL → FINAL
    .replace(/GR4ND/gi, "GRAND") // GR4ND → GRAND
    .replace(/1NV0ICE/gi, "INVOICE") // 1NV0ICE → INVOICE
    .replace(/CH4RGE/gi, "CHARGE") // CH4RGE → CHARGE
    .replace(/لثدال/g, "total");

  // normalize: lowercase, strip colons, dashes, extra spaces
  const lower = fixed
    .toLowerCase()
    .trim()
    .replace(/[:\-\.]+/g, " ") // colons, dashes, dots → space
    .replace(/\s+/g, " ") // multiple spaces → single space
    .trim();

  // blacklist check first — never process these rows
  const isBlacklisted = KEYWORDS.blacklist.some((k) => {
    const kNorm = k
      .toLowerCase()
      .replace(/[:\-\.]+/g, " ")
      .trim();
    return lower.includes(kNorm);
  });
  if (isBlacklisted) return 0;

  // tier 1 — high confidence keywords
  const isTier1 = KEYWORDS.tier1.some((k) => {
    const kNorm = k
      .toLowerCase()
      .replace(/[:\-\.]+/g, " ")
      .trim();
    return lower.includes(kNorm);
  });
  if (isTier1) return 1;

  // tier 2 — medium confidence
  const isTier2 = KEYWORDS.tier2.some((k) => {
    const kNorm = k
      .toLowerCase()
      .replace(/[:\-\.]+/g, " ")
      .trim();
    return lower.includes(kNorm);
  });
  if (isTier2) return 2;

  return -1; // not a keyword row
}

// ── Group OCR blocks into rows ────────────────────────────────────────────
// EasyOCR returns individual text blocks at various y positions
// blocks within 20px vertically are considered the same row
function groupIntoRows(blocks) {
  const rows = [];

  blocks.forEach((block) => {
    const existing = rows.find((r) => Math.abs(r.y - block.y) < 30);
    if (existing) {
      existing.blocks.push(block);
    } else {
      rows.push({ y: block.y, blocks: [block] });
    }
  });

  // sort rows top to bottom
  rows.sort((a, b) => a.y - b.y);

  // sort blocks within each row left to right
  rows.forEach((row) => {
    row.blocks.sort((a, b) => a.x - b.x);
  });

  return rows;
}

// ── Find total from OCR blocks ────────────────────────────────────────────
// Main parser function
// Strategy:
//   1. Group blocks into rows
//   2. Find rows containing total keywords
//   3. Validate against blacklist
//   4. Extract number from matching row
//   5. Tier 1 beats tier 2, lower on page beats higher for same tier

// ── Find total from OCR blocks ────────────────────────────────────────────
// Main parser function
// Strategy:
//   1. Group blocks into rows
//   2. Find rows containing total keywords
//   3. Validate against blacklist
//   4. Extract number from matching row (try merging adjacent blocks)
//   5. Tier 1 beats tier 2, lower on page beats higher for same tier
// ── Find total from OCR blocks ────────────────────────────────────────────
// Main parser function
// Strategy:
//   1. Group blocks into rows
//   2. Find rows containing total keywords
//   3. Check current row + adjacent rows (above and below) for the number
//   4. Validate against blacklist
//   5. Extract number from matching row (try merging adjacent blocks)
//   6. Tier 1 beats tier 2, lower on page beats higher for same tier
function findTotal(blocks) {
  const rows = groupIntoRows(blocks);

  let bestResult = null;
  let bestTier = 99;
  let bestY = -1;

  rows.forEach((row, rowIndex) => {
    const rowText = row.blocks.map((b) => b.text).join(" ");
    const tier = getKeywordTier(rowText);

    if (tier <= 0) return;

    const isCurrencyOnly = /^(usd|egp|eur|gbp|aed|sar)$/i.test(rowText.trim());
    if (isCurrencyOnly && tier === 2) {
      const maxY = Math.max(...rows.map((r) => r.y));
      const isBottomThird = row.y > maxY * 0.7;
      if (!isBottomThird) return;
    }

    let numberValue = null;
    let numberConf = 0;
    let numberText = "";

    const rowsToCheck = [
      row,
      rowIndex < rows.length - 1 ? rows[rowIndex + 1] : null,
      rowIndex < rows.length - 2 ? rows[rowIndex + 2] : null,
      rowIndex < rows.length - 3 ? rows[rowIndex + 3] : null,
      rowIndex < rows.length - 4 ? rows[rowIndex + 4] : null,
      rowIndex < rows.length - 5 ? rows[rowIndex + 5] : null,
      rowIndex < rows.length - 6 ? rows[rowIndex + 6] : null, // +6
      rowIndex < rows.length - 7 ? rows[rowIndex + 7] : null, // +7
      rowIndex < rows.length - 8 ? rows[rowIndex + 8] : null, // +8
      rowIndex > 0 ? rows[rowIndex - 1] : null,
      rowIndex > 1 ? rows[rowIndex - 2] : null,
      rowIndex > 2 ? rows[rowIndex - 3] : null,
      rowIndex > 3 ? rows[rowIndex - 4] : null,
      rowIndex > 4 ? rows[rowIndex - 5] : null,
      rowIndex > 5 ? rows[rowIndex - 6] : null, // +6
      rowIndex > 6 ? rows[rowIndex - 7] : null, // +7
      rowIndex > 7 ? rows[rowIndex - 8] : null, // +8
    ]
      .filter(Boolean)
      .filter((r) => Math.abs(r.y - row.y) < 100);

    // Sort rows by distance from keyword (closest first)
    const sortedRows = rowsToCheck.sort(
      (a, b) => Math.abs(a.y - row.y) - Math.abs(b.y - row.y),
    );

    for (const checkRow of sortedRows) {
      const blocksRightToLeft = [...checkRow.blocks].reverse();

      for (let i = 0; i < blocksRightToLeft.length; i++) {
        const block = blocksRightToLeft[i];

        let value = extractNumber(block.text);
        let bestValue = value;
        let bestText = block.text;
        let bestConf = block.confidence;

        // Try merging with next block
        // Try merging with next block (to the left in original order)
        if (i + 1 < blocksRightToLeft.length) {
          const nextBlock = blocksRightToLeft[i + 1];

          const minConf = Math.min(block.confidence, nextBlock.confidence);
          if (minConf > 0.25) {
            let combined;

            // **FIX: If next block is just zeros, merge as decimal**
            if (/^0+$/.test(nextBlock.text.trim())) {
              combined = extractNumber(nextBlock.text + "." + block.text);
            } else {
              combined = extractNumber(nextBlock.text + block.text);
            }

            const mergedText = nextBlock.text + " " + block.text;
            const mergedTier = getKeywordTier(mergedText);

            if (
              combined !== null &&
              mergedTier !== 0 &&
              (bestValue === null || combined > bestValue)
            ) {
              bestValue = combined;
              bestText = mergedText;
              bestConf = minConf;
            }
          }
        }

        // Try merging with block 2 positions away
        if (i + 2 < blocksRightToLeft.length) {
          const nextNextBlock = blocksRightToLeft[i + 2];

          const minConf = Math.min(block.confidence, nextNextBlock.confidence);
          if (minConf > 0.25) {
            const combined = extractNumber(nextNextBlock.text + block.text);

            const mergedText = nextNextBlock.text + " ... " + block.text;
            const mergedTier = getKeywordTier(mergedText);

            if (
              combined !== null &&
              mergedTier !== 0 &&
              (bestValue === null || combined > bestValue)
            ) {
              bestValue = combined;
              bestText = mergedText;
              bestConf = minConf;
            }
          }
        }

        if (bestValue !== null) {
          if (numberValue === null || bestValue > numberValue) {
            numberValue = bestValue;
            numberText = bestText;
            numberConf = bestConf;
          }
        }
      }

      if (numberValue !== null) break;
    }

    // Fallback: try extracting from full keyword row text
    if (numberValue === null) {
      if (rowText.includes(":")) {
        const afterColon = rowText.split(":").slice(1).join(":").trim();
        const tokens = afterColon.split(/\s+/);
        for (const token of tokens) {
          const value = extractNumber(token);
          if (value !== null && value > 10) {
            numberValue = value;
            numberConf = Math.min(...row.blocks.map((b) => b.confidence));
            numberText = token;
            break;
          }
        }
      }

      if (numberValue === null) {
        const value = extractNumber(rowText);
        if (value !== null) {
          numberValue = value;
          numberConf = Math.min(...row.blocks.map((b) => b.confidence));
          numberText = rowText;
        }
      }
    }

    if (numberValue === null) return;

    const isBetter = tier < bestTier || (tier === bestTier && row.y > bestY);

    if (isBetter) {
      bestResult = {
        value: numberValue,
        rawText: rowText,
        numberText: numberText,
        confidence: numberConf,
        tier,
        y: row.y,
      };
      bestTier = tier;
      bestY = row.y;
    }
  });

  if (bestResult === null) {
    return findLargestAmountInBottom(blocks);
  }

  return bestResult;
}

// ── Fallback: Find largest valid amount in bottom portion ─────────────────
// Used when no keyword is found (e.g., Fawry receipts, payment confirmations)
function findLargestAmountInBottom(blocks) {
  const maxY = Math.max(...blocks.map((b) => b.y));
  const bottomThreshold = maxY * 0.7;

  const bottomBlocks = blocks.filter((b) => b.y > bottomThreshold);

  // Count occurrences of each number value
  const numberCounts = {};
  const numberData = {};

  for (const block of bottomBlocks) {
    const value = extractNumber(block.text);
    if (value !== null && value > 10) {
      const key = value.toFixed(2); // group similar values
      numberCounts[key] = (numberCounts[key] || 0) + 1;
      if (!numberData[key] || block.confidence > numberData[key].confidence) {
        numberData[key] = {
          value,
          text: block.text,
          confidence: block.confidence,
        };
      }
    }
  }

  // Prefer numbers that appear 2+ times (like 406.01 appearing twice)
  for (const key in numberCounts) {
    if (numberCounts[key] >= 2) {
      return {
        value: numberData[key].value,
        rawText: numberData[key].text,
        numberText: numberData[key].text,
        confidence: numberData[key].confidence,
        tier: 3,
        y: maxY,
      };
    }
  }

  // Otherwise, take highest confidence number > 80%
  let bestAmount = null;
  let bestConf = 0;
  let bestText = "";

  for (const key in numberData) {
    const data = numberData[key];
    if (data.confidence > bestConf && data.confidence > 0.8) {
      bestAmount = data.value;
      bestConf = data.confidence;
      bestText = data.text;
    }
  }

  if (bestAmount !== null) {
    return {
      value: bestAmount,
      rawText: bestText,
      numberText: bestText,
      confidence: bestConf,
      tier: 3,
      y: maxY,
    };
  }

  return null;
}
module.exports = {
  findTotal,
  extractNumber,
  groupIntoRows,
  getKeywordTier,
  findLargestAmountInBottom,
};
