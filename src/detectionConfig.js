/**
 * Centralized Configuration for Hybrid LSH + BERT Detection System
 */

export const DetectionConfig = {
  // ============================================
  // LSH Configuration
  // ============================================
  LSH: {
    // Number of hash functions for MinHash
    NUM_HASH_FUNCTIONS: 20,

    // Number of bands for LSH
    NUM_BANDS: 10,

    // Similarity threshold for LSH (0-1)
    // Lower = more sensitive, more false positives
    // Higher = less sensitive, more false negatives
    SIMILARITY_THRESHOLD: 0.4,

    // Shingle configuration
    SHINGLE: {
      USE_WORDS: true,
      USE_BIGRAMS: true,
      USE_TRIGRAMS: true,
      USE_CHAR_NGRAMS: true,
      CHAR_NGRAM_SIZE: 5,
      MIN_WORD_LENGTH: 3,
    },
  },

  // ============================================
  // BERT Configuration
  // ============================================
  BERT: {
    // Enable/disable BERT verification
    ENABLED: true,

    // Model selection
    MODEL_NAME: "all-mpnet-base-v2",

    // Document-level threshold (for full article similarity)
    DOCUMENT_THRESHOLD: 0.85,

    PARAGRAPH_THRESHOLD: 0.8,

    // Sentence-level threshold (for individual sentence similarity)
    SENTENCE_THRESHOLD: 0.8,

    // Batch size for processing multiple sentences
    BATCH_SIZE: 10,

    // Cache settings
    CACHE: {
      MAX_SIZE: 10000,
      ENABLED: true,
    },

    // Document chunking
    MAX_TOKEN_LENGTH: 512, // BERT limit
  },

  // ============================================
  // Detection Strategy
  // ============================================
  STRATEGY: {
    // Detection flow:
    // 1. Document-level BERT check (optional, fast pre-filter)
    // 2. LSH sentence detection (fast filter)
    // 3. BERT sentence verification (accurate check)

    // Skip article if document-level similarity is too high
    CHECK_DOCUMENT_LEVEL: true,

    // Use BERT to verify LSH matches
    VERIFY_WITH_BERT: true,

    // Use BERT as final decision maker (override LSH if they disagree)
    BERT_FINAL_DECISION: false,

    // Minimum percentage of sentences that must be similar to consider plagiarism
    PARTIAL_PLAGIARISM_THRESHOLD: 0.3,
  },

  // ============================================
  // Scoring Configuration
  // ============================================
  SCORING: {
    // Maximum acceptable duplication ratio
    MAX_RATIO: 0.3,

    // Scoring formula for consecutive duplicates: 3^(n-1)
    CONSECUTIVE_BASE: 3,

    // Weight for isolated duplicates
    ISOLATED_WEIGHT: 1,
  },

  // ============================================
  // Performance Settings
  // ============================================
  PERFORMANCE: {
    // Use Web Workers for parallel processing (future enhancement)
    USE_WEB_WORKERS: false,

    // Maximum concurrent BERT operations
    MAX_CONCURRENT_BERT: 5,

    // Timeout for BERT operations (ms)
    BERT_TIMEOUT: 30000,

    // Enable detailed logging
    VERBOSE_LOGGING: true,
  },

  // ============================================
  // Storage Settings
  // ============================================
  STORAGE: {
    // Cache embeddings in IndexedDB
    CACHE_EMBEDDINGS: true,

    // Store sentence embeddings
    STORE_SENTENCE_EMBEDDINGS: true,

    // Store document embeddings
    STORE_DOCUMENT_EMBEDDINGS: true,

    // Periodically save cache (ms)
    AUTO_SAVE_INTERVAL: 60000, // 1 minute
  },

  // ============================================
  // Blockchain Settings
  // ============================================
  BLOCKCHAIN: {
    CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    RPC_URL: "http://127.0.0.1:8545",
    GAS_LIMIT: 1_000_000,

    // Store what on-chain
    STORE_ON_CHAIN: {
      IPFS_CID: true,
      ARTICLE_HASH: false,
      METADATA: false,
    },
  },

  // ============================================
  // Preset Configurations
  // ============================================
  PRESETS: {
    // High precision: Few false positives, may miss some plagiarism
    HIGH_PRECISION: {
      LSH_THRESHOLD: 0.5,
      BERT_SENTENCE_THRESHOLD: 0.92,
      BERT_DOCUMENT_THRESHOLD: 0.87,
    },

    // Balanced: Good trade-off
    BALANCED: {
      LSH_THRESHOLD: 0.4,
      BERT_SENTENCE_THRESHOLD: 0.9,
      BERT_DOCUMENT_THRESHOLD: 0.85,
    },

    // High recall: Catches more plagiarism, more false positives
    HIGH_RECALL: {
      LSH_THRESHOLD: 0.3,
      BERT_SENTENCE_THRESHOLD: 0.85,
      BERT_DOCUMENT_THRESHOLD: 0.8,
    },

    // LSH only: Fastest, lower accuracy
    LSH_ONLY: {
      BERT_ENABLED: false,
      LSH_THRESHOLD: 0.5,
    },

    // BERT only: Slowest, highest accuracy
    BERT_ONLY: {
      BERT_ENABLED: true,
      LSH_THRESHOLD: 0.0, // Accept all from LSH
      BERT_SENTENCE_THRESHOLD: 0.9,
      VERIFY_WITH_BERT: true,
    },
  },
};

export function applyPreset(presetName) {
  const preset = DetectionConfig.PRESETS[presetName];

  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}`);
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Applying preset: ${presetName}`);
  console.log(`${"=".repeat(50)}`);

  // Apply LSH settings
  if (preset.LSH_THRESHOLD !== undefined) {
    DetectionConfig.LSH.SIMILARITY_THRESHOLD = preset.LSH_THRESHOLD;
    console.log(`✓ LSH Threshold: ${preset.LSH_THRESHOLD}`);
  }

  // Apply BERT settings
  if (preset.BERT_ENABLED !== undefined) {
    DetectionConfig.BERT.ENABLED = preset.BERT_ENABLED;
    console.log(`✓ BERT Enabled: ${preset.BERT_ENABLED}`);
  }

  if (preset.BERT_SENTENCE_THRESHOLD !== undefined) {
    DetectionConfig.BERT.SENTENCE_THRESHOLD = preset.BERT_SENTENCE_THRESHOLD;
    console.log(`✓ BERT Sentence Threshold: ${preset.BERT_SENTENCE_THRESHOLD}`);
  }

  if (preset.BERT_DOCUMENT_THRESHOLD !== undefined) {
    DetectionConfig.BERT.DOCUMENT_THRESHOLD = preset.BERT_DOCUMENT_THRESHOLD;
    console.log(`✓ BERT Document Threshold: ${preset.BERT_DOCUMENT_THRESHOLD}`);
  }

  if (preset.VERIFY_WITH_BERT !== undefined) {
    DetectionConfig.STRATEGY.VERIFY_WITH_BERT = preset.VERIFY_WITH_BERT;
    console.log(`✓ Verify with BERT: ${preset.VERIFY_WITH_BERT}`);
  }

  console.log(`${"=".repeat(50)}\n`);
}

/**
 * Get current configuration summary
 */
export function getConfigSummary() {
  return {
    detection_mode: DetectionConfig.BERT.ENABLED
      ? "Hybrid (LSH + BERT)"
      : "LSH Only",
    lsh_threshold: DetectionConfig.LSH.SIMILARITY_THRESHOLD,
    bert_sentence_threshold: DetectionConfig.BERT.SENTENCE_THRESHOLD,
    bert_document_threshold: DetectionConfig.BERT.DOCUMENT_THRESHOLD,
    max_duplication_ratio: DetectionConfig.SCORING.MAX_RATIO,
    bert_model: DetectionConfig.BERT.MODEL_NAME,
  };
}

export function validateConfig() {
  const errors = [];

  if (
    DetectionConfig.LSH.SIMILARITY_THRESHOLD < 0 ||
    DetectionConfig.LSH.SIMILARITY_THRESHOLD > 1
  ) {
    errors.push("LSH threshold must be between 0 and 1");
  }

  if (
    DetectionConfig.BERT.SENTENCE_THRESHOLD < 0 ||
    DetectionConfig.BERT.SENTENCE_THRESHOLD > 1
  ) {
    errors.push("BERT sentence threshold must be between 0 and 1");
  }

  if (
    DetectionConfig.BERT.DOCUMENT_THRESHOLD < 0 ||
    DetectionConfig.BERT.DOCUMENT_THRESHOLD > 1
  ) {
    errors.push("BERT document threshold must be between 0 and 1");
  }

  // Validate band configuration
  if (
    DetectionConfig.LSH.NUM_HASH_FUNCTIONS % DetectionConfig.LSH.NUM_BANDS !==
    0
  ) {
    errors.push("NUM_HASH_FUNCTIONS must be divisible by NUM_BANDS");
  }

  if (errors.length > 0) {
    console.error("Configuration validation failed:");
    errors.forEach((err) => console.error(`  ✗ ${err}`));
    return false;
  }

  console.log("✓ Configuration validated successfully");
  return true;
}

export function printConfig() {
  console.log("\n" + "=".repeat(60));
  console.log("CURRENT DETECTION CONFIGURATION");
  console.log("=".repeat(60));

  console.log("\n📊 LSH Settings:");
  console.log(`  - Hash Functions: ${DetectionConfig.LSH.NUM_HASH_FUNCTIONS}`);
  console.log(`  - Bands: ${DetectionConfig.LSH.NUM_BANDS}`);
  console.log(`  - Threshold: ${DetectionConfig.LSH.SIMILARITY_THRESHOLD}`);

  console.log("\n🤖 BERT Settings:");
  console.log(`  - Enabled: ${DetectionConfig.BERT.ENABLED}`);
  console.log(`  - Model: ${DetectionConfig.BERT.MODEL_NAME}`);
  console.log(
    `  - Document Threshold: ${DetectionConfig.BERT.DOCUMENT_THRESHOLD}`
  );
  console.log(
    `  - Sentence Threshold: ${DetectionConfig.BERT.SENTENCE_THRESHOLD}`
  );

  console.log("\n🎯 Detection Strategy:");
  console.log(
    `  - Document-level Check: ${DetectionConfig.STRATEGY.CHECK_DOCUMENT_LEVEL}`
  );
  console.log(
    `  - BERT Verification: ${DetectionConfig.STRATEGY.VERIFY_WITH_BERT}`
  );
  console.log(
    `  - BERT Final Decision: ${DetectionConfig.STRATEGY.BERT_FINAL_DECISION}`
  );

  console.log("\n📈 Scoring:");
  console.log(`  - Max Ratio: ${DetectionConfig.SCORING.MAX_RATIO}`);
  console.log(
    `  - Consecutive Base: ${DetectionConfig.SCORING.CONSECUTIVE_BASE}`
  );

  console.log("=".repeat(60) + "\n");
}

// Export default config
export default DetectionConfig;
