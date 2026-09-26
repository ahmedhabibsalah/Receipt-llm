// Unit tests for pipeline/parser.js
// Run with: node --test pipeline/parser.test.js

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractNumber, getKeywordTier } = require("./parser");

// ══════════════════════════════════════════════════════════════════════════
// extractNumber
// ══════════════════════════════════════════════════════════════════════════

describe("extractNumber", () => {
  // ── plain numbers ──────────────────────────────────────────────────────
  describe("plain numbers", () => {
    it("parses a simple decimal", () => {
      assert.equal(extractNumber("93.42"), 93.42);
    });

    it("parses an integer", () => {
      assert.equal(extractNumber("100"), 100);
    });

    it("returns null for zero", () => {
      assert.equal(extractNumber("0"), null);
    });

    it("returns null for negative-looking value after stripping", () => {
      // After stripping non-digits only digits remain; negatives can't occur,
      // but ensure a bare "-" returns null.
      assert.equal(extractNumber("-"), null);
    });

    it("returns null for value above sanity ceiling (>9,999,999)", () => {
      assert.equal(extractNumber("10000000"), null);
    });

    it("returns null for empty string", () => {
      assert.equal(extractNumber(""), null);
    });

    it("returns null for pure text with no digits", () => {
      assert.equal(extractNumber("total"), null);
    });
  });

  // ── currency prefix stripping ─────────────────────────────────────────
  describe("currency prefix stripping", () => {
    it("strips EGP prefix", () => {
      assert.equal(extractNumber("EGP 545.99"), 545.99);
    });

    it("strips ٤GP (Arabic OCR variant of EGP)", () => {
      assert.equal(extractNumber("٤GP 140.00"), 140);
    });

    it("strips dollar sign", () => {
      assert.equal(extractNumber("$93.42"), 93.42);
    });

    it("strips USD suffix", () => {
      assert.equal(extractNumber("93.42 USD"), 93.42);
    });

    it("strips DL: prefix (Syrian pound)", () => {
      assert.equal(extractNumber("DL: 498.000"), 498);
    });

    it("strips LE prefix (Egyptian pound Latin)", () => {
      assert.equal(extractNumber("LE 200.00"), 200);
    });

    it("strips LEs prefix", () => {
      assert.equal(extractNumber("LEs 200.00"), 200);
    });

    it("strips /month suffix", () => {
      assert.equal(extractNumber("99.99/month"), 99.99);
    });

    it("strips trailing colon", () => {
      assert.equal(extractNumber("54.00:"), 54);
    });
  });

  // ── OCR error corrections ─────────────────────────────────────────────
  describe("OCR error corrections", () => {
    it("corrects E6P → EGP and strips it (E6P 560.00)", () => {
      assert.equal(extractNumber("E6P 560.00"), 560);
    });

    it("corrects E1P → EGP and strips it", () => {
      assert.equal(extractNumber("E1P 200.00"), 200);
    });

    it("strips bracket annotations e.g. 'Total [24]'", () => {
      assert.equal(extractNumber("24 [24]"), 24);
    });
  });

  // ── Arabic-Indic numerals ─────────────────────────────────────────────
  describe("Arabic-Indic numerals", () => {
    it("converts Arabic-Indic digits ٥٥,٩٩ → 55.99", () => {
      assert.equal(extractNumber("٥٥,٩٩"), 55.99);
    });

    it("converts a fully Arabic-Indic integer", () => {
      // ١٢٣ = 123
      assert.equal(extractNumber("١٢٣"), 123);
    });
  });

  // ── European number formats ───────────────────────────────────────────
  describe("European number formats", () => {
    it("handles period-as-thousands, comma-as-decimal (1.051,00)", () => {
      assert.equal(extractNumber("1.051,00"), 1051);
    });

    it("handles double-dot thousands (2.215.25 → 2215.25)", () => {
      assert.equal(extractNumber("2.215.25"), 2215.25);
    });

    it("handles comma-only decimal (55,99 → 55.99)", () => {
      assert.equal(extractNumber("55,99"), 55.99);
    });

    it("handles multiple commas — last is decimal (11,599,00 → 11599.00)", () => {
      assert.equal(extractNumber("11,599,00"), 11599);
    });

    it("handles comma-as-thousands, dot-as-decimal (1,051.00)", () => {
      assert.equal(extractNumber("1,051.00"), 1051);
    });
  });

  // ── Whitespace in numbers ─────────────────────────────────────────────
  describe("whitespace in numbers", () => {
    it("removes whitespace to parse spaced number (11, 599, 00 → 11599)", () => {
      assert.equal(extractNumber("11, 599, 00"), 11599);
    });

    it("treats trailing 2-digit group after space as decimal (93 42 → 93.42)", () => {
      // digit-space-2digits pattern: "93 42" → "93.42"
      assert.equal(extractNumber("93 42"), 93.42);
    });
  });

  // ── Leading-dot OCR patterns ──────────────────────────────────────────
  describe("leading-dot OCR patterns", () => {
    it("handles .XX. XX pattern (.53. 28 → 53.28)", () => {
      assert.equal(extractNumber(".53. 28"), 53.28);
    });

    it("strips a plain leading dot (.99 → 99, treated as integer)", () => {
      // ".99" → leading dot stripped → "99" → 99
      assert.equal(extractNumber(".99"), 99);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════
// getKeywordTier
// ══════════════════════════════════════════════════════════════════════════

describe("getKeywordTier", () => {
  // ── tier 1 ────────────────────────────────────────────────────────────
  describe("tier 1 keywords", () => {
    it("returns 1 for 'grand total'", () => {
      assert.equal(getKeywordTier("grand total"), 1);
    });

    it("returns 1 for 'total due'", () => {
      assert.equal(getKeywordTier("total due"), 1);
    });

    it("returns 1 for 'amount due'", () => {
      assert.equal(getKeywordTier("amount due"), 1);
    });

    it("returns 1 for 'invoice total'", () => {
      assert.equal(getKeywordTier("invoice total"), 1);
    });

    it("returns 1 for 'total' alone (French receipts)", () => {
      assert.equal(getKeywordTier("total"), 1);
    });

    it("returns 1 for Arabic الإجمالي", () => {
      assert.equal(getKeywordTier("الإجمالي"), 1);
    });

    it("returns 1 for Hungarian 'összesen'", () => {
      assert.equal(getKeywordTier("összesen"), 1);
    });

    it("is case-insensitive (GRAND TOTAL)", () => {
      assert.equal(getKeywordTier("GRAND TOTAL"), 1);
    });

    it("strips trailing colon before matching (Total:)", () => {
      assert.equal(getKeywordTier("Total:"), 1);
    });

    it("strips trailing dash before matching (Total -)", () => {
      assert.equal(getKeywordTier("Total -"), 1);
    });
  });

  // ── tier 1 via OCR correction ─────────────────────────────────────────
  describe("tier 1 via OCR character correction", () => {
    it("corrects T0TAL → TOTAL and returns 1", () => {
      assert.equal(getKeywordTier("T0TAL"), 1);
    });

    it("corrects GR4ND T0TAL → GRAND TOTAL and returns 1", () => {
      assert.equal(getKeywordTier("GR4ND T0TAL"), 1);
    });

    it("corrects 1NV0ICE T0TAL → INVOICE TOTAL and returns 1", () => {
      assert.equal(getKeywordTier("1NV0ICE T0TAL"), 1);
    });

    it("corrects F1NAL T0TAL → FINAL TOTAL and returns 1", () => {
      assert.equal(getKeywordTier("F1NAL T0TAL"), 1);
    });
  });

  // ── tier 2 ────────────────────────────────────────────────────────────
  describe("tier 2 keywords", () => {
    it("returns 2 for 'amount'", () => {
      assert.equal(getKeywordTier("amount"), 2);
    });

    it("returns 2 for currency code 'usd'", () => {
      assert.equal(getKeywordTier("usd"), 2);
    });

    it("returns 2 for currency code 'EGP'", () => {
      assert.equal(getKeywordTier("EGP"), 2);
    });
  });

  // ── blacklist ─────────────────────────────────────────────────────────
  describe("blacklisted keywords → 0", () => {
    it("returns 0 for 'subtotal'", () => {
      assert.equal(getKeywordTier("subtotal"), 0);
    });

    it("returns 0 for 'sub total'", () => {
      assert.equal(getKeywordTier("sub total"), 0);
    });

    it("returns 0 for 'vat'", () => {
      assert.equal(getKeywordTier("vat"), 0);
    });

    it("returns 0 for 'tax'", () => {
      assert.equal(getKeywordTier("tax"), 0);
    });

    it("returns 0 for 'discount'", () => {
      assert.equal(getKeywordTier("discount"), 0);
    });

    it("returns 0 for 'delivery fee'", () => {
      assert.equal(getKeywordTier("delivery fee"), 0);
    });

    it("returns 0 for 'Total Taxes $6.92' (35.webp case)", () => {
      assert.equal(getKeywordTier("Total Taxes $6.92"), 0);
    });

    it("returns 0 for 'Total no. of items 6' (42.jpg case)", () => {
      assert.equal(getKeywordTier("Total no. of items 6"), 0);
    });

    it("returns 0 for 'change'", () => {
      assert.equal(getKeywordTier("change"), 0);
    });

    it("blacklist takes priority over tier 1 match", () => {
      // "items total" contains "total" (tier1) but also "items total" (blacklist)
      assert.equal(getKeywordTier("items total"), 0);
    });
  });

  // ── no match ──────────────────────────────────────────────────────────
  describe("no keyword match → -1", () => {
    it("returns -1 for an unrelated word", () => {
      assert.equal(getKeywordTier("chicken sandwich"), -1);
    });

    it("returns -1 for a plain number string", () => {
      assert.equal(getKeywordTier("93.42"), -1);
    });

    it("returns -1 for empty string", () => {
      assert.equal(getKeywordTier(""), -1);
    });
  });
});
