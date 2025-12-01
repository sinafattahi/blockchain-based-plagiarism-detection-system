import { ethers, Contract } from "ethers";
import { set, get } from "idb-keyval";
import { CONTRACT_ABI } from "../constants";
import { uploadToIPFS, getFromIPFS } from "../services/ipfsService";
import { Buffer } from "buffer";
// Import BERT service
import { getBERTService } from "../services/bertService";
// Import centralized configuration
import DetectionConfig from "../detectionConfig";
import {
  computeHash,
  createShingles,
  findSimilarSentencesLSH,
  generateSignature,
  storeSentenceInLSH,
} from "./lshFunctions";
import {
  addToVectorIndex,
  // checkDocumentSimilarity,
  findFirstBertMatch,
  generateRandomPlanes,
  getVectorIndexStats,
} from "./bertFunctions";

// ============================================
// Cache Structure with Article Tracking + Vector Index
// ============================================
let lshCache = {
  bands: {},
  sentences: {},
  signatureMap: {},
  sentenceToArticle: {},
  sentenceEmbeddings: {},
  documentEmbeddings: {},
  randomPlanes: [],
  vectorIndex: {},
};

// Statistics tracker
let ratioStats = {};
let bertStats = {
  totalVerifications: 0,
  lshFailedBertPassed: 0,
  bothPassed: 0,
  avgBertTime: 0,
  documentRejections: 0,
};

// Initialize BERT service
let bertService = null;

// ============================================
// Initialization
// ============================================
async function init() {
  await loadCache();

  if (DetectionConfig.BERT.ENABLED) {
    try {
      bertService = getBERTService();
      await bertService.initialize();

      console.log("✓ BERT Service initialized successfully");
      console.log(`  Model: ${DetectionConfig.BERT.MODEL_NAME}`);
      console.log(
        `  Document Threshold: ${DetectionConfig.BERT.DOCUMENT_THRESHOLD}`
      );
      console.log(
        `  Sentence Threshold: ${DetectionConfig.BERT.SENTENCE_THRESHOLD}`
      );
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
  console.log(`  Hash Functions: ${DetectionConfig.LSH.NUM_HASH_FUNCTIONS}`);
  console.log(`  Bands: ${DetectionConfig.LSH.NUM_BANDS}`);
  console.log(`  Threshold: ${DetectionConfig.LSH.SIMILARITY_THRESHOLD}`);
}

// ============================================
// Cache Management (FIXED)
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
    sentenceToArticle: cached?.sentenceToArticle || {},
    sentenceEmbeddings: cached?.sentenceEmbeddings || {},
    documentEmbeddings: cached?.documentEmbeddings || {},
    randomPlanes: cached?.randomPlanes || (await generateRandomPlanes()),
    vectorIndex: cached?.vectorIndex || {
      buckets: {},
    },
  };

  // ✅ Rebuild vector index if needed
  if (
    Object.keys(lshCache.sentenceEmbeddings).length > 0 &&
    Object.keys(lshCache.vectorIndex.buckets).length === 0
  ) {
    console.log("🔨 Rebuilding vector index buckets...");
    rebuildVectorIndex();

    const indexStats = getVectorIndexStats(lshCache);
    console.log(`📊 Vector Index Stats:`, indexStats);

    if (indexStats.totalBuckets === 1) {
      console.warn(
        "⚠️  WARNING: All embeddings in ONE bucket - regenerate random planes!"
      );
      lshCache.randomPlanes = await generateRandomPlanes(384);
      rebuildVectorIndex();
    }
  }

  function rebuildVectorIndex() {
    lshCache.vectorIndex.buckets = {}; // Clear old buckets

    for (const [hash, embedding] of Object.entries(
      lshCache.sentenceEmbeddings
    )) {
      if (embedding && lshCache.sentenceToArticle[hash]) {
        // Use the exported function to handle hashing + bucketing
        addToVectorIndex(lshCache, hash, embedding);
      }
    }
    console.log(`✓ Vector index rebuilt into buckets.`);
  }

  const cachedStats = await get("ratioStats");
  ratioStats = cachedStats || {};

  const cachedBertStats = await get("bertStats");
  bertStats = cachedBertStats || {
    totalVerifications: 0,
    lshFailedBertPassed: 0,
    bothPassed: 0,
    avgBertTime: 0,
    documentRejections: 0,
  };

  console.log("📂 Cache loaded:", {
    sentences: Object.keys(lshCache.sentences).length,
    bands: Object.keys(lshCache.bands).length,
    articles: new Set(Object.values(lshCache.sentenceToArticle)).size,
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

  console.log("\n" + "=".repeat(60));
  console.log("DETECTION STATISTICS");
  console.log("=".repeat(60));

  // ✅ Article and Sentence Counts
  const totalSentences = Object.keys(lshCache.sentences).length;
  const totalArticles = new Set(Object.values(lshCache.sentenceToArticle)).size;

  console.log("\n📚 Database Overview:");
  console.log(`  - Total Articles Processed: ${totalArticles}`);
  console.log(`  - Total Unique Sentences: ${totalSentences}`);
  console.log(
    `  - Avg Sentences/Article: ${
      totalArticles > 0 ? (totalSentences / totalArticles).toFixed(1) : 0
    }`
  );

  // LSH Stats
  console.log("\n📊 LSH Configuration:");
  console.log(`  - Hash Functions: ${DetectionConfig.LSH.NUM_HASH_FUNCTIONS}`);
  console.log(`  - Bands: ${DetectionConfig.LSH.NUM_BANDS}`);
  console.log(`  - Threshold: ${DetectionConfig.LSH.SIMILARITY_THRESHOLD}`);

  // BERT Stats
  if (
    DetectionConfig.BERT.ENABLED &&
    (bertStats.totalVerifications > 0 || bertStats.documentRejections > 0)
  ) {
    console.log("\n🤖 BERT Verification Statistics:");

    if (bertStats.documentRejections > 0) {
      console.log(
        `  - Document Rejections: ${bertStats.documentRejections} (full article duplicates)`
      );
    }

    console.log(
      `  - Total BERT Verifications: ${bertStats.totalVerifications}`
    );
    console.log(`  - LSH Found Duplicates: ${bertStats.bothPassed}`);
    console.log(
      `  - BERT Found (LSH Missed): ${bertStats.lshFailedBertPassed} ⭐`
    );
    console.log(
      `  - Avg BERT Time: ${bertStats.avgBertTime.toFixed(
        2
      )}ms per verification`
    );

    if (bertStats.totalVerifications > 0) {
      const totalDuplicates =
        bertStats.bothPassed + bertStats.lshFailedBertPassed;
      const bertContribution =
        bertStats.lshFailedBertPassed > 0
          ? ((bertStats.lshFailedBertPassed / totalDuplicates) * 100).toFixed(1)
          : 0;
      console.log(
        `  - BERT's Extra Contribution: ${bertContribution}% of all duplicates found`
      );
    }
  }
}

// ============================================
// Scoring Function
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
// ✅ MAIN PROCESS: Doc Check -> LSH -> BERT -> Save
// ============================================
async function processArticle(articleId, article, signer) {
  const startTime = performance.now();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing Article ${articleId}`);
  console.log(`${"=".repeat(60)}`);

  // ---------------------------------------------------------
  // 🔴 STAGE 1: Document-Level BERT Check
  // ---------------------------------------------------------
  // const docCheck = await checkDocumentSimilarity(
  //   lshCache,
  //   bertService,
  //   articleId,
  //   article
  // );

  // if (docCheck.isDuplicate) {
  //   console.log(
  //     `⛔ Article REJECTED (Document Similarity > ${DetectionConfig.BERT.DOCUMENT_THRESHOLD})`
  //   );
  //   bertStats.documentRejections++;
  //   await saveCache(); // Save stats
  //   return false;
  // }

  // ---------------------------------------------------------
  // 🟠 STAGE 2: LSH Sentence Scan
  // ---------------------------------------------------------
  console.log("\n👉 STAGE 2: Running LSH Scan on sentences...");

  const sentences = article.split("\n").filter((s) => s.trim().length > 0);
  const sentenceHashes = sentences.map(computeHash);
  let sentenceResults = new Array(sentences.length).fill(null);

  let lshDetections = 0;
  let bertDetections = 0;

  // Temp storage for new BERT embeddings (to be saved in Stage 4)
  const tempEmbeddings = {};

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceHash = sentenceHashes[i];
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    // Check LSH
    const result = findSimilarSentencesLSH(
      lshCache,
      signature,
      sentenceHash,
      articleId
    );

    sentenceResults[i] = {
      ...result,
      signature: signature,
      shingles: shingles,
      sentence: sentence,
      hash: sentenceHash,
    };

    if (result.isDuplicate) {
      lshDetections++;
      console.log(`   [LSH] Duplicate: "${sentence.substring(0, 30)}..."`);
    }
  }

  // 🛑 CHECKPOINT: Post-LSH Evaluation
  let currentScore = computeScore(sentenceResults);
  let currentRatio = sentences.length ? currentScore / sentences.length : 0;

  console.log(`\n📊 Post-LSH Ratio: ${currentRatio.toFixed(3)}`);

  if (currentRatio > 0.3) {
    console.log(`⛔ Article REJECTED by LSH.`);
    addRatioToStats(currentRatio);
    await saveCache();
    return false;
  }

  // ---------------------------------------------------------
  // 🟡 STAGE 3: Sentence-Level BERT Verification
  // ---------------------------------------------------------
  if (DetectionConfig.BERT.ENABLED && bertService) {
    console.log("\n👉 STAGE 3: Running BERT on unique sentences...");

    for (let i = 0; i < sentences.length; i++) {
      // Skip if LSH already caught it
      if (sentenceResults[i].isDuplicate) continue;

      const sentence = sentences[i];
      const sentenceHash = sentenceHashes[i];

      try {
        // 1. Get Embedding
        let embedding = lshCache.sentenceEmbeddings[sentenceHash];
        if (!embedding) {
          if (tempEmbeddings[sentenceHash]) {
            embedding = tempEmbeddings[sentenceHash];
          } else {
            embedding = await bertService.getSentenceEmbedding(sentence);
            tempEmbeddings[sentenceHash] = embedding; // Hold in temp
          }
        }

        // 2. Check Vector Index
        const bertResult = findFirstBertMatch(lshCache, embedding, articleId);

        if (bertResult.isDuplicate) {
          console.log(`   [BERT] Caught: "${sentence.substring(0, 30)}..."`);

          sentenceResults[i] = {
            ...sentenceResults[i],
            isDuplicate: true,
            similarity: bertResult.similarity,
            matchedArticleId: bertResult.matchedArticleId,
            detectionMethod: "BERT-CaughtIt",
          };
          bertDetections++;
        }
      } catch (err) {
        console.error(`   [BERT] Error:`, err);
      }
    }
  }

  // 🛑 CHECKPOINT: Final Evaluation
  const finalScore = computeScore(sentenceResults);
  const finalRatio = sentences.length ? finalScore / sentences.length : 0;

  addRatioToStats(finalRatio);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Final Results for Article ${articleId}:`);
  console.log(`  - LSH Detections: ${lshDetections}`);
  console.log(`  - BERT Detections: ${bertDetections}`);
  console.log(`  - Ratio: ${finalRatio.toFixed(3)} (Max: 0.3)`);
  console.log(`${"=".repeat(60)}`);

  if (finalRatio > 0.3) {
    console.log(`⛔ Article REJECTED (Ratio > 0.3)`);
    await saveCache();
    return false;
  }

  // ---------------------------------------------------------
  // 🟢 STAGE 4: Storage (Commit Data)
  // ---------------------------------------------------------
  console.log(`\n💾 Storing data...`);

  // 1. Store Document Embedding (Calculated in Stage 1)
  // if (docCheck.embedding) {
  //   lshCache.documentEmbeddings[articleId] = docCheck.embedding;
  // }

  const uniqueHashesToStore = [];

  for (let i = 0; i < sentenceResults.length; i++) {
    const res = sentenceResults[i];

    // Only store UNIQUE sentences
    if (!res.isDuplicate) {
      uniqueHashesToStore.push(res.hash);

      // 2. Store LSH Data
      storeSentenceInLSH(
        lshCache,
        res.sentence,
        res.hash,
        res.signature,
        articleId
      );

      // 3. Store BERT Data (from temp)
      if (tempEmbeddings[res.hash]) {
        const embedding = tempEmbeddings[res.hash];
        lshCache.sentenceEmbeddings[res.hash] = embedding;
        addToVectorIndex(lshCache, res.hash, embedding);
      }
    }
  }

  // 4. IPFS & Blockchain
  try {
    const hashesData = JSON.stringify(uniqueHashesToStore);
    const hashesBuffer = Buffer.from(hashesData);
    const ipfsCid = await uploadToIPFS(hashesBuffer);

    const contract = new Contract(contractAddress, contractAbi, signer);
    const tx = await contract.storeArticleCID(articleId, ipfsCid, {
      gasLimit: 1_000_000,
    });
    await tx.wait();
    console.log(`✓ Stored on Blockchain: ${tx.hash}`);
  } catch (error) {
    console.error("✗ Storage error:", error);
    return false;
  }

  // 5. Final Save to Disk
  await saveCache();

  console.log(`✅ Article ${articleId} ACCEPTED.`);
  console.log(
    `   Total Time: ${(performance.now() - startTime).toFixed(0)}ms\n`
  );

  return true;
}

function resetStatistics() {
  ratioStats = {};
  bertStats = {
    totalVerifications: 0,
    lshFailedBertPassed: 0,
    bothPassed: 0,
    avgBertTime: 0,
    documentRejections: 0,
  };
  saveCache();
  console.log("✓ Statistics reset");
}

// ============================================
// Blockchain Functions
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
  debugPrintCache,
  provider,
  contractAbi,
  contractAddress,
  printStatistics,
  resetStatistics,
  addRatioToStats,
  bertStats,
};
