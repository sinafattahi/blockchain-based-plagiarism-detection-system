import { ethers, Contract, utils } from "ethers";
import { set, get } from "idb-keyval";
import { CONTRACT_ABI } from "./constants";
import { uploadToIPFS, getFromIPFS } from "./services/ipfsService";
import { Buffer } from "buffer";
// Import BERT service
import { getBERTService } from "./services/bertService";
// Import centralized configuration
import DetectionConfig from "./detectionConfig";

// ============================================
// Dynamic Configuration (uses DetectionConfig)
// ============================================
const getConfig = () => ({
  // LSH Configuration
  NUM_HASH_FUNCTIONS: DetectionConfig.LSH.NUM_HASH_FUNCTIONS,
  NUM_BANDS: DetectionConfig.LSH.NUM_BANDS,
  BAND_SIZE:
    DetectionConfig.LSH.NUM_HASH_FUNCTIONS / DetectionConfig.LSH.NUM_BANDS,
  LSH_SIMILARITY_THRESHOLD: DetectionConfig.LSH.SIMILARITY_THRESHOLD,

  // BERT Configuration
  BERT_DOCUMENT_THRESHOLD: DetectionConfig.BERT.DOCUMENT_THRESHOLD,
  BERT_SENTENCE_THRESHOLD: DetectionConfig.BERT.SENTENCE_THRESHOLD,
  BERT_VERIFICATION_ENABLED: DetectionConfig.BERT.ENABLED,

  // Scoring
  MAX_RATIO: DetectionConfig.SCORING.MAX_RATIO,
  CONSECUTIVE_BASE: DetectionConfig.SCORING.CONSECUTIVE_BASE,
});

// ============================================
// Cache Structure
// ============================================
let lshCache = {
  bands: {},
  sentences: {}, // sentenceHash -> sentence text
  signatureMap: {}, // sentenceHash -> signature
  sentenceToArticle: {}, // sentenceHash -> articleId (NEW!)
  sentenceEmbeddings: {},
  documentEmbeddings: {},
};

// Statistics tracker
let ratioStats = {};
let bertStats = {
  totalVerifications: 0,
  lshPassedBertFailed: 0,
  lshFailedBertPassed: 0,
  bothPassed: 0,
  avgBertTime: 0,
};

// Initialize BERT service
let bertService = null;

// ============================================
// Initialization
// ============================================
async function init() {
  await loadCache();

  const config = getConfig();

  if (config.BERT_VERIFICATION_ENABLED) {
    try {
      bertService = getBERTService();
      await bertService.initialize();

      console.log("✓ BERT Service initialized successfully");
      console.log(`  Model: ${DetectionConfig.BERT.MODEL_NAME}`);
      console.log(`  Document Threshold: ${config.BERT_DOCUMENT_THRESHOLD}`);
      console.log(`  Sentence Threshold: ${config.BERT_SENTENCE_THRESHOLD}`);
    } catch (error) {
      console.error("✗ Failed to initialize BERT:", error);
      console.log("→ Falling back to LSH-only mode");
      DetectionConfig.BERT.ENABLED = false;
    }
  } else {
    console.log("ℹ️  BERT verification disabled - using LSH only");
  }

  // Print current configuration
  console.log("\n📊 LSH Configuration:");
  console.log(`  Hash Functions: ${config.NUM_HASH_FUNCTIONS}`);
  console.log(`  Bands: ${config.NUM_BANDS}`);
  console.log(`  Threshold: ${config.LSH_SIMILARITY_THRESHOLD}`);
}

// ============================================
// Cache Management
// ============================================
const saveCache = async () => {
  await set("lshCache", lshCache);
  await set("ratioStats", ratioStats);
  await set("bertStats", bertStats);
};

const loadCache = async () => {
  const cached = await get("lshCache");

  // ✅ Ensure all properties exist with proper defaults
  lshCache = {
    bands: cached?.bands || {},
    sentences: cached?.sentences || {},
    signatureMap: cached?.signatureMap || {},
    sentenceToArticle: cached?.sentenceToArticle || {}, // ✅ Handle legacy caches
    sentenceEmbeddings: cached?.sentenceEmbeddings || {},
    documentEmbeddings: cached?.documentEmbeddings || {},
  };

  const cachedStats = await get("ratioStats");
  ratioStats = cachedStats || {};

  const cachedBertStats = await get("bertStats");
  bertStats = cachedBertStats || {
    totalVerifications: 0,
    lshPassedBertFailed: 0,
    lshFailedBertPassed: 0,
    bothPassed: 0,
    avgBertTime: 0,
  };

  console.log("📂 Cache loaded:", {
    sentences: Object.keys(lshCache.sentences).length,
    bands: Object.keys(lshCache.bands).length,
    articles: Object.keys(lshCache.sentenceToArticle).length,
  });
};

// ============================================
// Statistics Functions
// ============================================
function addRatioToStats(ratio) {
  const roundedRatio = Math.round(ratio * 100) / 100;
  const ratioKey = roundedRatio.toFixed(2);
  ratioStats[ratioKey] = (ratioStats[ratioKey] || 0) + 1;
}

async function printStatistics() {
  await loadCache();
  const config = getConfig();

  console.log("\n" + "=".repeat(60));
  console.log("DETECTION STATISTICS");
  console.log("=".repeat(60));

  const totalSentences = Object.keys(lshCache.sentences).length;
  const totalArticles = Object.values(lshCache.sentenceToArticle).reduce(
    (set, id) => {
      set.add(id);
      return set;
    },
    new Set()
  ).size;

  console.log("\n📚 Database Overview:");
  console.log(`  - Total Articles Processed: ${totalArticles}`);
  console.log(`  - Total Unique Sentences: ${totalSentences}`);

  // LSH Stats
  console.log("\n📊 LSH Configuration:");
  console.log(`  - Hash Functions: ${config.NUM_HASH_FUNCTIONS}`);
  console.log(`  - Bands: ${config.NUM_BANDS}`);
  console.log(`  - Threshold: ${config.LSH_SIMILARITY_THRESHOLD}`);

  // BERT Stats
  if (config.BERT_VERIFICATION_ENABLED && bertStats.totalVerifications > 0) {
    console.log("\n🤖 BERT Verification Statistics:");
    console.log(`  - Total Verifications: ${bertStats.totalVerifications}`);
    console.log(`  - Both LSH & BERT Passed: ${bertStats.bothPassed}`);
    console.log(
      `  - LSH Passed, BERT Failed: ${bertStats.lshPassedBertFailed}`
    );
    console.log(
      `  - LSH Failed, BERT Passed: ${bertStats.lshFailedBertPassed}`
    );
    console.log(`  - Avg BERT Time: ${bertStats.avgBertTime.toFixed(2)}ms`);

    const accuracy = (
      (bertStats.bothPassed / bertStats.totalVerifications) *
      100
    ).toFixed(2);
    console.log(`  - LSH-BERT Agreement: ${accuracy}%`);
  }

  // Ratio Distribution
  console.log("\n📈 Ratio Distribution:");
  console.log("  Ratio\t\tCount");
  console.log("  " + "-".repeat(30));

  const sortedRatios = Object.keys(ratioStats).sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  sortedRatios.forEach((ratio) => {
    console.log(`  ${ratio}\t\t${ratioStats[ratio]}`);
  });

  console.log("=".repeat(60));
}

function resetStatistics() {
  ratioStats = {};
  bertStats = {
    totalVerifications: 0,
    lshPassedBertFailed: 0,
    lshFailedBertPassed: 0,
    bothPassed: 0,
    avgBertTime: 0,
  };
  console.log("✓ Statistics reset");
}

// ============================================
// LSH Functions (Original - Unchanged, with safety fixes)
// ============================================
function computeHash(sentence) {
  return utils.keccak256(utils.toUtf8Bytes(sentence));
}

function normalizeSentence(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createShingles(sentence) {
  const normalized = normalizeSentence(sentence);
  const words = normalized.split(/\s+/).filter((word) => word.length > 0);
  const shingles = new Set();

  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "he",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "that",
    "the",
    "to",
    "was",
    "were",
    "will",
    "with",
    "but",
    "they",
    "have",
    "had",
    "what",
    "each",
    "which",
    "she",
    "do",
    "how",
    "their",
    "if",
    "so",
    "some",
    "her",
    "would",
    "like",
    "him",
    "than",
    "been",
    "who",
    "now",
    "did",
    "get",
    "come",
    "made",
    "may",
  ]);

  words.forEach((word) => {
    if (word.length > 2 && !stopWords.has(word)) {
      shingles.add(word);
    }
  });

  for (let i = 0; i < words.length - 1; i++) {
    shingles.add(words[i] + " " + words[i + 1]);
  }

  if (words.length >= 3) {
    for (let i = 0; i < words.length - 2; i++) {
      shingles.add(words[i] + " " + words[i + 1] + " " + words[i + 2]);
    }
  }

  if (normalized.length > 10) {
    for (let i = 0; i < normalized.length - 4; i++) {
      const ngram = normalized.substring(i, i + 5);
      if (!/^\s*$/.test(ngram)) {
        shingles.add(ngram);
      }
    }
  }

  return Array.from(shingles);
}

function generateSignature(shingles) {
  const config = getConfig();

  const primes = [
    2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71,
    73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151,
  ];

  const saltValues = [
    0x9e3779b9, 0x85ebca6b, 0xc2b2ae3d, 0x27d4eb2f, 0x165667b1, 0x9a8b7c6d,
    0xf1e2d3c4, 0x5a4b3c2d, 0x1e2f3a4b, 0x6c5d4e3f, 0xa9b8c7d6, 0x2d1e3f4a,
    0x8b7c6d5e, 0x4f3e2d1c, 0xd6c5b4a3, 0x1a2b3c4d, 0x7e6f5a4b, 0x3c2d1e4f,
    0xb9a8c7d6, 0x5e4f3a2b,
  ];

  function hashFunction(i, shingle) {
    let hash = saltValues[i % saltValues.length];
    const prime = primes[i % primes.length];

    for (let j = 0; j < shingle.length; j++) {
      hash = ((hash ^ shingle.charCodeAt(j)) * prime) % Number.MAX_SAFE_INTEGER;
    }

    return Math.abs(hash);
  }

  const signature = new Array(config.NUM_HASH_FUNCTIONS).fill(
    Number.MAX_SAFE_INTEGER
  );

  shingles.forEach((shingle) => {
    for (let i = 0; i < config.NUM_HASH_FUNCTIONS; i++) {
      const hashValue = hashFunction(i, shingle);
      signature[i] = Math.min(signature[i], hashValue);
    }
  });

  return signature;
}

function calculateSimilarity(signature1, signature2) {
  let matchCount = 0;
  for (let i = 0; i < signature1.length; i++) {
    if (signature1[i] === signature2[i]) {
      matchCount++;
    }
  }
  return matchCount / signature1.length;
}

function getBandHashes(signature) {
  const config = getConfig();

  const bandHashes = [];
  for (let i = 0; i < config.NUM_BANDS; i++) {
    const bandValues = signature.slice(
      i * config.BAND_SIZE,
      (i + 1) * config.BAND_SIZE
    );
    const bandStr = bandValues.join(",");
    const bandHash = utils.keccak256(utils.toUtf8Bytes(bandStr));
    bandHashes.push(bandHash);
  }
  return bandHashes;
}

// ============================================
// HYBRID LSH + BERT Detection
// ============================================
async function findSimilarSentencesHybrid(
  sentence,
  sentenceHash,
  signature,
  articleId
) {
  const config = getConfig();

  // Phase 1: LSH Detection with article awareness
  const lshResult = findSimilarSentencesLSH(signature, sentenceHash, articleId);

  console.log("LSH Result:", {
    isDuplicate: lshResult.isDuplicate,
    similarity: lshResult.similarity,
    currentArticle: articleId,
    matchedArticle: lshResult.matchedArticleId,
  });

  // If no LSH candidates or BERT disabled
  if (
    !lshResult.isDuplicate ||
    !config.BERT_VERIFICATION_ENABLED ||
    !bertService
  ) {
    return {
      ...lshResult,
      detectionMethod: "LSH",
      bertVerified: false,
    };
  }

  // ✅ Double-check: Ensure matched article is different
  if (lshResult.matchedArticleId === articleId) {
    console.warn("⚠️ LSH matched same article - should not happen!");
    return {
      isDuplicate: false,
      detectionMethod: "LSH-SameArticle",
      bertVerified: false,
    };
  }

  // Phase 2: BERT Verification
  const bertStart = performance.now();

  try {
    let currentEmbedding = lshCache.sentenceEmbeddings[sentenceHash];
    if (!currentEmbedding) {
      currentEmbedding = await bertService.getSentenceEmbedding(sentence);
      lshCache.sentenceEmbeddings[sentenceHash] = currentEmbedding;
    }

    const matchedSentenceHash = lshResult.similarSentenceHash;
    let matchedEmbedding = lshCache.sentenceEmbeddings[matchedSentenceHash];

    if (!matchedEmbedding) {
      const matchedSentence = lshCache.sentences[matchedSentenceHash];
      if (!matchedSentence) {
        console.warn("Matched sentence not in cache");
        return {
          ...lshResult,
          detectionMethod: "LSH-NoText",
          bertVerified: false,
        };
      }
      matchedEmbedding = await bertService.getSentenceEmbedding(
        matchedSentence
      );
      lshCache.sentenceEmbeddings[matchedSentenceHash] = matchedEmbedding;
    }

    const bertSimilarity = await bertService.calculateSimilarity(
      currentEmbedding,
      matchedEmbedding
    );

    const bertTime = performance.now() - bertStart;

    // Update stats
    bertStats.totalVerifications++;
    bertStats.avgBertTime =
      (bertStats.avgBertTime * (bertStats.totalVerifications - 1) + bertTime) /
      bertStats.totalVerifications;

    const bertPassed = bertSimilarity >= config.BERT_SENTENCE_THRESHOLD;
    const lshPassed = lshResult.similarity >= config.LSH_SIMILARITY_THRESHOLD;

    if (lshPassed && bertPassed) {
      bertStats.bothPassed++;
    } else if (lshPassed && !bertPassed) {
      bertStats.lshPassedBertFailed++;
      console.log(
        `⚠️ LSH False Positive (LSH: ${lshResult.similarity.toFixed(
          3
        )}, BERT: ${bertSimilarity.toFixed(3)})`
      );
    } else if (!lshPassed && bertPassed) {
      bertStats.lshFailedBertPassed++;
    }

    console.log("BERT Verification:", {
      similarity: bertSimilarity,
      threshold: config.BERT_SENTENCE_THRESHOLD,
      passed: bertPassed,
    });

    // ✅ CRITICAL FIX: Use LSH result as baseline, BERT as verification
    if (DetectionConfig.STRATEGY.BERT_FINAL_DECISION && bertPassed) {
      return {
        isDuplicate: true,
        similarSentenceHash: lshResult.similarSentenceHash,
        similarity: bertSimilarity,
        matchedSentence: lshResult.matchedSentence,
        matchedArticleId: lshResult.matchedArticleId,
        detectionMethod: "BERT-Verified",
        bertVerified: true,
        lshSimilarity: lshResult.similarity,
        bertTime,
      };
    } else if (DetectionConfig.STRATEGY.BERT_FINAL_DECISION && !bertPassed) {
      return {
        isDuplicate: false,
        detectionMethod: "BERT-Rejected",
        bertVerified: true,
        lshSimilarity: lshResult.similarity,
        bertSimilarity,
        bertTime,
      };
    } else {
      // Keep LSH decision, add BERT info
      return {
        ...lshResult,
        detectionMethod: bertPassed ? "LSH+BERT-Agree" : "LSH-Only",
        bertVerified: true,
        bertSimilarity,
        bertTime,
      };
    }
  } catch (error) {
    console.error("BERT verification failed:", error);
    return {
      ...lshResult,
      detectionMethod: "LSH-BertError",
      bertVerified: false,
      bertError: error.message,
    };
  }
}

// Original LSH detection (renamed)
// Now accepts currentSentenceHash to avoid self-matches
function findSimilarSentencesLSH(
  signature,
  currentSentenceHash,
  currentArticleId
) {
  const config = getConfig();
  const bandHashes = getBandHashes(signature);
  const candidateHashes = new Set();

  bandHashes.forEach((bandHash, bandIndex) => {
    if (lshCache.bands[bandIndex] && lshCache.bands[bandIndex][bandHash]) {
      lshCache.bands[bandIndex][bandHash].forEach((hash) => {
        // ✅ FIXED: Only skip if it's the SAME sentence in the SAME article
        const candidateArticleId = lshCache.sentenceToArticle[hash];
        const isSameSentenceInSameArticle =
          hash === currentSentenceHash &&
          candidateArticleId === currentArticleId;

        if (!isSameSentenceInSameArticle) {
          candidateHashes.add(hash);
        }
      });
    }
  });

  let bestMatch = { isDuplicate: false };
  let highestSimilarity = 0;

  for (const candidateHash of candidateHashes) {
    const candidateSignature = lshCache.signatureMap[candidateHash];
    if (!candidateSignature) continue;

    const similarity = calculateSimilarity(signature, candidateSignature);

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      if (similarity >= config.LSH_SIMILARITY_THRESHOLD) {
        const candidateArticleId = lshCache.sentenceToArticle[candidateHash];
        bestMatch = {
          isDuplicate: true,
          similarSentenceHash: candidateHash,
          similarity,
          matchedSentence: lshCache.sentences[candidateHash],
          matchedArticleId: candidateArticleId, // Include source article
        };
      }
    }
  }

  return bestMatch;
}

function storeSentenceInLSH(sentence, sentenceHash, signature, articleId) {
  lshCache.sentences[sentenceHash] = sentence;
  lshCache.signatureMap[sentenceHash] = signature;
  lshCache.sentenceToArticle[sentenceHash] = articleId; // ✅ Track article ownership

  const bandHashes = getBandHashes(signature);
  bandHashes.forEach((bandHash, bandIndex) => {
    if (!lshCache.bands[bandIndex]) {
      lshCache.bands[bandIndex] = {};
    }
    if (!lshCache.bands[bandIndex][bandHash]) {
      lshCache.bands[bandIndex][bandHash] = [];
    }
    if (!lshCache.bands[bandIndex][bandHash].includes(sentenceHash)) {
      lshCache.bands[bandIndex][bandHash].push(sentenceHash);
    }
  });
}

// ============================================
// Document-Level BERT Check
// ============================================
async function checkDocumentSimilarity(articleId, articleText) {
  const config = getConfig();

  if (!config.BERT_VERIFICATION_ENABLED || !bertService) {
    return { isDuplicate: false, method: "BERT-Disabled" };
  }

  if (!DetectionConfig.STRATEGY.CHECK_DOCUMENT_LEVEL) {
    return { isDuplicate: false, method: "Document-Check-Disabled" };
  }

  try {
    // Get or compute document embedding
    let currentDocEmbedding = lshCache.documentEmbeddings[articleId];
    if (!currentDocEmbedding) {
      currentDocEmbedding = await bertService.getDocumentEmbedding(articleText);
      lshCache.documentEmbeddings[articleId] = currentDocEmbedding;
    }

    // Check against all existing documents
    for (const [existingId, existingEmbedding] of Object.entries(
      lshCache.documentEmbeddings
    )) {
      if (String(existingId) === String(articleId)) continue;

      const similarity = await bertService.calculateSimilarity(
        currentDocEmbedding,
        existingEmbedding
      );

      if (similarity >= config.BERT_DOCUMENT_THRESHOLD) {
        console.log(`🚨 Document-level duplicate detected!`);
        console.log(`   Current: ${articleId}`);
        console.log(`   Similar to: ${existingId}`);
        console.log(`   Similarity: ${similarity.toFixed(3)}`);

        return {
          isDuplicate: true,
          similarArticleId: existingId,
          similarity: similarity,
          method: "BERT-Document",
        };
      }
    }

    return { isDuplicate: false, method: "BERT-Document" };
  } catch (error) {
    console.error("Document-level BERT check failed:", error);
    return { isDuplicate: false, method: "BERT-Error" };
  }
}

// ============================================
// Scoring Function (Original)
// ============================================
function computeScore(duplicateResults) {
  let score = 0;
  let hasDuplicates = false;
  let i = 0;

  while (i < duplicateResults.length) {
    if (!duplicateResults[i].isDuplicate) {
      i++;
      continue;
    }

    hasDuplicates = true;
    let n = 0;

    while (i < duplicateResults.length && duplicateResults[i].isDuplicate) {
      n++;
      i++;
    }

    if (n > 1) {
      score += 3 ** (n - 1);
    } else {
      score += 1;
    }
  }

  if (hasDuplicates && score === 0) {
    score = 1;
  }

  return score;
}

// ============================================
// Main Process Article Function (UPDATED)
// ============================================
async function processArticle(articleId, article, signer) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing Article ${articleId}`);
  console.log(`${"=".repeat(60)}`);

  // Step 1: Document-level BERT check (fast early rejection)
  const docCheck = await checkDocumentSimilarity(articleId, article);
  if (docCheck.isDuplicate) {
    console.log(`⛔ Article ${articleId} is a document-level duplicate`);
    console.log(`   Similar to: ${docCheck.similarArticleId}`);
    console.log(`   Similarity: ${docCheck.similarity.toFixed(3)}`);
    console.log(`   Method: ${docCheck.method}`);
    return false;
  }

  const sentences = article.split("\n").filter((s) => s.trim().length > 0);
  const sentenceHashes = sentences.map(computeHash);

  const duplicateResults = [];
  const uniqueHashes = [];
  const uniqueSentences = [];

  console.log(`📋 Total sentences in article: ${sentences.length}`);
  console.log(
    `📚 Sentences already in cache: ${Object.keys(lshCache.sentences).length}`
  );

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceHash = sentenceHashes[i];

    console.log(
      `\n[${i + 1}/${sentences.length}] Checking: "${sentence.substring(
        0,
        80
      )}..."`
    );

    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    // ✅ Pass articleId for proper self-match detection
    const result = await findSimilarSentencesHybrid(
      sentence,
      sentenceHash,
      signature,
      articleId
    );

    duplicateResults.push(result);

    if (result.isDuplicate) {
      console.log(`   ❌ DUPLICATE DETECTED!`);
      console.log(`      Method: ${result.detectionMethod}`);
      console.log(
        `      Matched from Article: ${result.matchedArticleId || "Unknown"}`
      );
      console.log(
        `      LSH Similarity: ${(
          result.lshSimilarity || result.similarity
        ).toFixed(3)}`
      );
      if (result.bertSimilarity) {
        console.log(
          `      BERT Similarity: ${result.bertSimilarity.toFixed(3)}`
        );
      }
      console.log(
        `      Matched Text: "${(result.matchedSentence || "").substring(
          0,
          60
        )}..."`
      );
    } else {
      console.log(`   ✅ UNIQUE - Will be stored`);
      uniqueSentences.push(sentence);
      uniqueHashes.push(sentenceHash);
    }
  }

  const score = computeScore(duplicateResults);
  const ratio = sentences.length ? score / sentences.length : 0;

  addRatioToStats(ratio);

  console.log(
    `  - Total: ${sentences.length}, Unique: ${uniqueSentences.length}`
  );
  console.log(`  - Duplicate Score: ${score}, Ratio: ${ratio.toFixed(3)}`);
  console.log(`${"=".repeat(60)}`);

  if (ratio > 0.3) {
    console.log(`⛔ REJECTED (ratio > 0.3)`);
    return false;
  }

  // ✅ Store unique sentences WITH article ID
  for (let i = 0; i < uniqueSentences.length; i++) {
    const sentence = uniqueSentences[i];
    const sentenceHash = uniqueHashes[i];
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    storeSentenceInLSH(sentence, sentenceHash, signature, articleId);
  }

  try {
    const hashesData = JSON.stringify(uniqueHashes);
    const hashesBuffer = Buffer.from(hashesData);
    const ipfsCid = await uploadToIPFS(hashesBuffer);
    console.log(`✓ Stored hashes on IPFS with CID: ${ipfsCid}`);

    const contract = new Contract(contractAddress, contractAbi, signer);
    const tx = await contract.storeArticleCID(articleId, ipfsCid, {
      gasLimit: 1_000_000,
    });
    await tx.wait();
    console.log(
      `✓ Stored Article ${articleId} CID on blockchain, tx hash: ${tx.hash}`
    );
  } catch (error) {
    console.error("✗ Error in IPFS/Blockchain storage:", error);
    return false;
  }

  await saveCache();
  console.log(`✅ Article ${articleId} ACCEPTED\n`);
  return true;
}

// ============================================
// Blockchain Functions (Original)
// ============================================
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const contractAbi = CONTRACT_ABI;

async function getTotalArticles(signerOrProvider) {
  const contract = new Contract(contractAddress, contractAbi, signerOrProvider);
  const total = await contract.totalArticles();
  return total.toNumber();
}

async function getStoredArticle(articleId, signer) {
  const contract = new Contract(contractAddress, contractAbi, signer);
  try {
    const cid = await contract.getArticleCID(articleId);

    if (!cid || cid === "") {
      console.log(`No CID found for articleId ${articleId}`);
      return null;
    }

    const ipfsData = await getFromIPFS(cid);
    const hashes = JSON.parse(ipfsData.toString());

    const sentences = hashes.map(
      (h) => lshCache.sentences[h] || "[Unknown Sentence]"
    );

    return { sentences, cid };
  } catch (error) {
    console.error(`Failed to fetch article ${articleId}:`, error);
    return null;
  }
}

async function debugPrintCache() {
  const cache = await get("lshCache");
  console.log("LSH Cache:", cache);
  return cache;
}

// ============================================
// Exports
// ============================================
export {
  init,
  processArticle,
  getStoredArticle,
  getTotalArticles,
  computeHash,
  debugPrintCache,
  provider,
  contractAbi,
  contractAddress,
  printStatistics,
  resetStatistics,
  addRatioToStats,
  // New exports
  bertStats,
  getConfig,
};
