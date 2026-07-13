// ══════════════════════════════════════════════════════════════════════════
// RECEIPT ANALYZER DEMO - FRONTEND
// ══════════════════════════════════════════════════════════════════════════

const API_BASE = "http://localhost:3000/api";

let currentImage = null;

// Elements
const uploadSection = document.getElementById("upload-section");
const validationSection = document.getElementById("validation-section");
const extractionSection = document.getElementById("extraction-section");

const uploadArea = document.getElementById("upload-area");
const fileInput = document.getElementById("file-input");

const previewImage = document.getElementById("preview-image");
const resultImage = document.getElementById("result-image");

const validationStatus = document.getElementById("validation-status");
const validationProgress = document.getElementById("validation-progress");
const validationResult = document.getElementById("validation-result");
const confidenceBadge = document.getElementById("confidence-badge");

const extractBtn = document.getElementById("extract-btn");

const extractionStatus = document.getElementById("extraction-status");
const extractionProgress = document.getElementById("extraction-progress");
const extractionResult = document.getElementById("extraction-result");
const validationBadge = document.getElementById("validation-badge");
const totalDisplay = document.getElementById("total-display");

const resetBtn = document.getElementById("reset-btn");

// ══════════════════════════════════════════════════════════════════════════
// UPLOAD HANDLING
// ══════════════════════════════════════════════════════════════════════════

uploadArea.addEventListener("click", () => fileInput.click());

uploadArea.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadArea.classList.add("dragover");
});

uploadArea.addEventListener("dragleave", () => {
  uploadArea.classList.remove("dragover");
});

uploadArea.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadArea.classList.remove("dragover");

  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleImageUpload(file);
  }
});

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    handleImageUpload(file);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// IMAGE PROCESSING
// ══════════════════════════════════════════════════════════════════════════

function handleImageUpload(file) {
  currentImage = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImage.src = e.target.result;
    resultImage.src = e.target.result;
  };
  reader.readAsDataURL(file);

  // Switch to validation section
  showSection("validation");

  // Start validation
  validateReceipt(file);
}

async function validateReceipt(file) {
  try {
    // Show loading state
    validationResult.classList.add("hidden");
    validationStatus.style.display = "flex";
    animateProgress(validationProgress, 3000);

    // Send to API
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/validate`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Hide loading
    validationStatus.style.display = "none";
    validationProgress.style.width = "100%";

    // Show result
    setTimeout(() => {
      showValidationResult(data);
    }, 300);
  } catch (error) {
    console.error("Validation error:", error);
    showError("Failed to validate image");
  }
}

function showValidationResult(data) {
  const confidence = (data.confidence * 100).toFixed(1);

  if (data.isReceipt) {
    confidenceBadge.className = "badge success";
    confidenceBadge.textContent = `✓ Receipt Detected (${confidence}% confidence)`;
    extractBtn.disabled = false;
    extractBtn.style.opacity = "1";
    extractBtn.style.cursor = "pointer";
  } else {
    const notReceiptConfidence = (100 - data.confidence * 100).toFixed(1);
    confidenceBadge.className = "badge error";
    confidenceBadge.textContent = `✗ Not a Receipt (${notReceiptConfidence}% confidence)`;
    extractBtn.disabled = true;
    extractBtn.style.opacity = "0.5";
    extractBtn.style.cursor = "not-allowed";
  }

  validationResult.classList.remove("hidden");
}

extractBtn.addEventListener("click", () => {
  if (currentImage) {
    showSection("extraction");
    extractTotal(currentImage);
  }
});

async function extractTotal(file) {
  try {
    // Show loading state
    extractionResult.classList.add("hidden");
    extractionStatus.style.display = "flex";
    animateProgress(extractionProgress, 15000); // OCR takes longer

    // Send to API
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`${API_BASE}/extract`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    // Hide loading
    extractionStatus.style.display = "none";
    extractionProgress.style.width = "100%";

    // Show result
    setTimeout(() => {
      showExtractionResult(data);
    }, 300);
  } catch (error) {
    console.error("Extraction error:", error);
    showError("Failed to extract total");
  }
}

function showExtractionResult(data) {
  // Show validation badge again
  validationBadge.textContent = "✓ Receipt Validated";

  if (data.success) {
    totalDisplay.textContent = `$${data.total.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  } else {
    totalDisplay.innerHTML = `<span style="color: var(--error)">Total Not Found</span>`;
  }

  extractionResult.classList.remove("hidden");
}

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

function showSection(name) {
  uploadSection.classList.remove("active");
  validationSection.classList.remove("active");
  extractionSection.classList.remove("active");

  if (name === "upload") uploadSection.classList.add("active");
  if (name === "validation") validationSection.classList.add("active");
  if (name === "extraction") extractionSection.classList.add("active");
}

function animateProgress(element, duration) {
  element.style.width = "0%";
  setTimeout(() => {
    element.style.transition = `width ${duration}ms linear`;
    element.style.width = "95%";
  }, 50);
}

function showError(message) {
  alert(message);
  reset();
}

function reset() {
  currentImage = null;
  fileInput.value = "";
  validationProgress.style.width = "0%";
  extractionProgress.style.width = "0%";
  showSection("upload");
}

resetBtn.addEventListener("click", reset);
