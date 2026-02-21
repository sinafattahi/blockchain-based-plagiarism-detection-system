import { Buffer } from "buffer";
import { set, get } from "idb-keyval";
import { ethers, Contract } from "ethers";

import { CONTRACT_ABI } from "../constants";
import DetectionConfig from "../detectionConfig";
import { getBERTService } from "../services/bertService";
import { uploadToIPFS, getFromIPFS } from "../services/ipfsService";
import {
  computeHash,
  createShingles,
  findSimilarSentencesLSH,
  generateSignature,
  storeSentenceInLSH,
} from "./lshFunctions";
import {
  checkDocumentSimilarity,
  findFirstBertMatch,
  findBestParagraphMatch,
} from "./bertFunctions";
import { metricsCollector } from "./metricsCollector";

const globalMetricsBackup = [];

// ============================================
// Cache Structure with Article Tracking
// ============================================
let general2Cache = {
  bands: {},
  sentences: {},
  signatureMap: {},
  sentenceToArticle: {},
  sentenceEmbeddings: {},
  documentEmbeddings: {},
  paragraphEmbeddings: {},
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
        `  Document Threshold: ${DetectionConfig.BERT.DOCUMENT_THRESHOLD}`,
      );
      console.log(
        `  Sentence Threshold: ${DetectionConfig.BERT.SENTENCE_THRESHOLD}`,
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
// Cache Management
// ============================================
const saveCache = async () => {
  // fix later
  await set("general2Cache", general2Cache);
  await set("ratioStats", ratioStats);
  await set("bertStats", bertStats);
};

const loadCache = async () => {
  // fix later
  const cached = await get("general2Cache");

  general2Cache = {
    bands: cached?.bands || {},
    sentences: cached?.sentences || {},
    signatureMap: cached?.signatureMap || {},
    sentenceToArticle: cached?.sentenceToArticle || {},
    sentenceEmbeddings: cached?.sentenceEmbeddings || {},
    documentEmbeddings: cached?.documentEmbeddings || {},
    paragraphEmbeddings: cached?.paragraphEmbeddings || {},
  };

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
    sentences: Object.keys(general2Cache.sentences).length,
    embeddings: Object.keys(general2Cache.sentenceEmbeddings).length,
    bands: Object.keys(general2Cache.bands).length,
    articles: new Set(Object.values(general2Cache.sentenceToArticle)).size,
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
  const totalSentences = Object.keys(general2Cache.sentences).length;
  const totalArticles = new Set(Object.values(general2Cache.sentenceToArticle))
    .size;

  console.log("\n📚 Database Overview:");
  console.log(`  - Total Articles Processed: ${totalArticles}`);
  console.log(`  - Total Unique Sentences: ${totalSentences}`);
  console.log(
    `  - Avg Sentences/Article: ${
      totalArticles > 0 ? (totalSentences / totalArticles).toFixed(1) : 0
    }`,
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
        `  - Document Rejections: ${bertStats.documentRejections} (full article duplicates)`,
      );
    }

    console.log(
      `  - Total BERT Verifications: ${bertStats.totalVerifications}`,
    );
    console.log(`  - LSH Found Duplicates: ${bertStats.bothPassed}`);
    console.log(
      `  - BERT Found (LSH Missed): ${bertStats.lshFailedBertPassed} ⭐`,
    );
    console.log(
      `  - Avg BERT Time: ${bertStats.avgBertTime.toFixed(
        2,
      )}ms per verification`,
    );

    if (bertStats.totalVerifications > 0) {
      const totalDuplicates =
        bertStats.bothPassed + bertStats.lshFailedBertPassed;
      const bertContribution =
        bertStats.lshFailedBertPassed > 0
          ? ((bertStats.lshFailedBertPassed / totalDuplicates) * 100).toFixed(1)
          : 0;
      console.log(
        `  - BERT's Extra Contribution: ${bertContribution}% of all duplicates found`,
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

function hasCitation(text) {
  // الگوی 1: براکت مثل [1]، [12]، [1-3]، [1, 5]
  const bracketRegex = /\[\s*\d+(?:\s*[-,\u2013]\s*\d+)*\s*\]/;

  // الگوی 2: پرانتز شامل سال میلادی مثل (Smith, 2020) یا (2019)
  // دنبال پرانتزی می‌گردد که داخلش عددی بین 1900 تا 2099 باشد
  const yearRegex = /\([^)]*\b(?:19|20)\d{2}\b[^)]*\)/;

  return bracketRegex.test(text) || yearRegex.test(text);
}

// ============================================
// ✅ MAIN PROCESS: Doc Check -> LSH -> BERT -> Save
// ============================================
async function processArticle(articleId, sentenceText, paragraphText, signer) {
  const startTime = performance.now();

  const cacheSizeBefore = JSON.stringify(general2Cache).length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing Article ${articleId}`);
  console.log(`${"=".repeat(60)}`);

  const sentences = sentenceText.split("\n").filter((s) => s.trim().length > 0);
  const sentenceHashes = sentences.map(computeHash);
  const paragraphs = paragraphText
    ? paragraphText.split("\n\n").filter((p) => p.trim().length > 50)
    : [];

  console.log(
    `Input: ${sentences.length} Sentences | ${paragraphs.length} Paragraphs`,
  );

  // ---------------------------------------------------------
  // 🔴 STAGE 1:  LSH (Sentence Level)
  // ---------------------------------------------------------
  console.log("👉 STAGE 1: Running LSH Scan on sentences...");

  let lshDetections = 0;
  let sentenceResults = new Array(sentences.length).fill(null);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    if (hasCitation(sentence)) {
      sentenceResults[i] = {
        isDuplicate: false,
        hash: computeHash(sentence),
        sentence: sentence,
        signature: [],
        skipped: true,
      };
      continue;
    }

    const sentenceHash = sentenceHashes[i];
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    // LSH Check
    const result = findSimilarSentencesLSH(
      general2Cache,
      signature,
      sentenceHash,
      articleId,
    );

    sentenceResults[i] = {
      ...result,
      signature,
      sentence,
      hash: sentenceHash,
      isDuplicate: result.isDuplicate,
    };

    if (result.isDuplicate) lshDetections++;
  }

  let lshScore = computeScore(sentenceResults);
  let lshRatio = sentences.length ? lshScore / sentences.length : 0;

  console.log(
    `   [LSH Result] Detections: ${lshDetections} | Ratio: ${lshRatio.toFixed(
      3,
    )}`,
  );

  if (lshRatio > 0.3) {
    console.log(`⛔ Article REJECTED by LSH (Ratio: ${lshRatio.toFixed(2)})`);
    return false;
  }

  // =========================================================
  // 2️⃣ STAGE 2: Document-Level BERT
  // =========================================================
  const docCheck = await checkDocumentSimilarity(
    general2Cache,
    bertService,
    articleId,
    sentenceText,
  );

  if (docCheck.isDuplicate) {
    console.log(`⛔ Article REJECTED (Document Similarity > Threshold)`);
    return false;
  }

  // =========================================================
  // 3️⃣ STAGE 3: Paragraph-Level BERT
  // =========================================================
  console.log("\n👉 STAGE 3: Running Paragraph BERT verification...");
  let paraDetections = 0;
  const tempParaEmbeddings = {};

  if (DetectionConfig.BERT.ENABLED && paragraphs.length > 0) {
    for (const para of paragraphs) {
      if (hasCitation(para)) {
        console.log(
          `   ⏩ Skipped cited paragraph: "${para.substring(0, 20)}..."`,
        );
        continue;
      }

      const paraHash = computeHash(para);

      const embedding = await bertService.getDocumentEmbedding(para);
      tempParaEmbeddings[paraHash] = embedding;

      const match = findBestParagraphMatch(general2Cache, embedding, articleId);

      if (match.isDuplicate) {
        console.log(
          `   [PARA] Duplicate found (${match.similarity.toFixed(2)})`,
        );
        paraDetections++;
      }
    }
  } else {
    console.log(
      "   ⚠️ Skipping Paragraph Check (BERT disabled or no paragraphs)",
    );
  }

  const paraRatio = paragraphs.length ? paraDetections / paragraphs.length : 0;
  console.log(
    `   [Para Result] Detections: ${paraDetections} | Ratio: ${paraRatio.toFixed(
      3,
    )}`,
  );

  if (paraRatio > 0.3) {
    console.log(
      `⛔ Article REJECTED by Paragraph Check (Ratio: ${paraRatio.toFixed(2)})`,
    );
    return false;
  }

  // =========================================================
  // 4️⃣ STAGE 4: Sentence-Level BERT
  // =========================================================
  console.log("\n👉 STAGE 4: Running Sentence BERT verification...");
  let bertSentenceDetections = 0;
  const tempSentenceEmbeddings = {};

  if (DetectionConfig.BERT.ENABLED) {
    for (let i = 0; i < sentences.length; i++) {
      if (sentenceResults[i].isDuplicate) continue;

      const sentenceHash = sentenceHashes[i];
      let embedding = general2Cache.sentenceEmbeddings[sentenceHash];

      if (!embedding) {
        embedding = await bertService.getSentenceEmbedding(sentences[i]);
        tempSentenceEmbeddings[sentenceHash] = embedding;
      }

      const bertResult = findFirstBertMatch(general2Cache, embedding, articleId);

      if (bertResult.isDuplicate) {
        console.log(`   [BERT] Caught: "${sentences[i].substring(0, 30)}..."`);
        sentenceResults[i].isDuplicate = true;
        bertSentenceDetections++;
      }
    }
  }

  // =========================================================
  // Final Evaluation
  // =========================================================
  const finalScore = computeScore(sentenceResults);
  const finalRatio = sentences.length ? finalScore / sentences.length : 0;

  console.log(
    `\n📊 Final Results: LSH: ${lshDetections} | Para: ${paraDetections} | BERT-Sent: ${bertSentenceDetections}`,
  );
  console.log(`   Final Ratio: ${finalRatio.toFixed(3)}`);

  if (finalRatio > 0.3) {
    console.log(`⛔ Article REJECTED (Final Ratio > 0.3)`);
    return false;
  }

  console.log(`\n💾 Storing data...`);

  if (docCheck.embedding) {
    general2Cache.documentEmbeddings[articleId] = docCheck.embedding;
  }

  for (const [hash, emb] of Object.entries(tempParaEmbeddings)) {
    general2Cache.paragraphEmbeddings[hash] = emb;
  }

  const uniqueHashesToStore = [];
  for (let i = 0; i < sentenceResults.length; i++) {
    const res = sentenceResults[i];
    if (!res.isDuplicate) {
      uniqueHashesToStore.push(res.hash);

      storeSentenceInLSH(
        general2Cache,
        res.sentence,
        res.hash,
        res.signature,
        articleId,
      );

      if (tempSentenceEmbeddings[res.hash]) {
        general2Cache.sentenceEmbeddings[res.hash] =
          tempSentenceEmbeddings[res.hash];
      }
    }
  }

  let metrics = null;

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

    // 📊 دریافت receipt برای gasUsed
    const receipt = await provider.getTransactionReceipt(tx.hash);
    const gasUsed = receipt?.gasUsed?.toString() || "0";

    // 📊 اندازه‌گیری کش بعد از پردازش
    const cacheSizeAfter = JSON.stringify(general2Cache).length;
    const cacheGrowth = cacheSizeAfter - cacheSizeBefore;

    // 🎯 ایجاد آبجکت متریک‌ها
    metrics = {
      articleId,
      accepted: finalRatio <= 0.3,
      processingTime: performance.now() - startTime,
      rejectionReason:
        finalRatio > 0.3
          ? lshRatio > 0.3
            ? "lsh"
            : docCheck?.isDuplicate
            ? "document"
            : paraRatio > 0.3
            ? "paragraph"
            : "final"
          : null,
      lshDetections,
      bertDetections: bertSentenceDetections,
      paraDetections,
      finalRatio,
      uniqueHashesCount: uniqueHashesToStore.length,
      ipfsSize: hashesBuffer.length,
      ipfsCID: ipfsCid,
      gasUsed: gasUsed,
      txHash: tx.hash,
      cacheSizeBefore,
      cacheSizeAfter,
      cacheGrowth,
      sentencesCount: sentences.length,
      paragraphsCount: paragraphs.length,
    };

    console.log(`📊 Metrics recorded for article ${articleId}:`, {
      processingTime: metrics.processingTime.toFixed(0) + "ms",
      cacheGrowth: metrics.cacheGrowth + " bytes",
      ipfsSize: metrics.ipfsSize + " bytes",
      gasUsed: metrics.gasUsed,
    });

    // 💾 ذخیره در کلکتور (اگر وجود دارد)
    if (metricsCollector) {
      metricsCollector.recordArticle(articleId, metrics);
      metricsCollector.saveToLocalStorage();
    } else {
      // ✅ ذخیره در backup
      globalMetricsBackup.push(metrics);
      console.log("📝 Metrics saved to backup array:", metrics.articleId);
    }
  } catch (error) {
    console.error("✗ Storage error:", error);

    const errorMetrics = {
      articleId,
      accepted: false,
      processingTime: performance.now() - startTime,
      rejectionReason: "storage_error",
      error: error.message,
      cacheSizeBefore,
      cacheSizeAfter: JSON.stringify(general2Cache).length,
    };

    // ذخیره خطا هم در backup
    globalMetricsBackup.push(errorMetrics);

    // حتی در صورت خطا، کش رو ذخیره کن
    await saveCache();
    return { success: false, error: error.message, metrics: errorMetrics };
  }

  // 5. Final Save to Disk
  await saveCache();

  console.log(
    `✅ Article ${articleId} ${finalRatio <= 0.3 ? "ACCEPTED" : "REJECTED"}.`,
  );
  console.log(
    `   Total Time: ${(performance.now() - startTime).toFixed(0)}ms\n`,
  );

  return {
    success: finalRatio <= 0.3,
    metrics: metrics, // متریک‌ها رو هم برگردون
  };
}

function getBackupMetrics() {
  return globalMetricsBackup;
}

function clearBackupMetrics() {
  globalMetricsBackup.length = 0;
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
      (h) => general2Cache.sentences[h] || "[Unknown Sentence]",
    );

    return { sentences, cid };
  } catch (error) {
    console.error(`Failed to fetch article ${articleId}:`, error);
    return null;
  }
}

async function debugPrintCache() {
  const cache = await get("general2Cache");
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
  getBackupMetrics,
  clearBackupMetrics,
};
