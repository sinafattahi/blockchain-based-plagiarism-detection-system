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

// ============================================
// Cache Structure with Article Tracking
// ============================================
let generalCache = {
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
// Cache Management
// ============================================
const saveCache = async () => {
  // fix later
  await set("generalCache", generalCache);
  await set("ratioStats", ratioStats);
  await set("bertStats", bertStats);
};

const loadCache = async () => {
  // fix later
  const cached = await get("generalCache");

  generalCache = {
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
    sentences: Object.keys(generalCache.sentences).length,
    embeddings: Object.keys(generalCache.sentenceEmbeddings).length,
    bands: Object.keys(generalCache.bands).length,
    articles: new Set(Object.values(generalCache.sentenceToArticle)).size,
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
  const totalSentences = Object.keys(generalCache.sentences).length;
  const totalArticles = new Set(Object.values(generalCache.sentenceToArticle))
    .size;

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
async function processArticle(articleId, sentenceText, paragraphText, signer) {
  const startTime = performance.now();

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing Article ${articleId}`);
  console.log(`${"=".repeat(60)}`);

  const sentences = sentenceText.split("\n").filter((s) => s.trim().length > 0);
  const sentenceHashes = sentences.map(computeHash);

  const paragraphs = paragraphText
    ? paragraphText.split("\n\n").filter((p) => p.trim().length > 50)
    : [];

  console.log(
    `Input: ${sentences.length} Sentences | ${paragraphs.length} Paragraphs`
  );

  // ---------------------------------------------------------
  // 🔴 STAGE 1:  LSH (Sentence Level)
  // ---------------------------------------------------------
  console.log("👉 STAGE 1: Running LSH Scan on sentences...");

  let lshDetections = 0;
  let sentenceResults = new Array(sentences.length).fill(null);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceHash = sentenceHashes[i];
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    // LSH Check
    const result = findSimilarSentencesLSH(
      generalCache,
      signature,
      sentenceHash,
      articleId
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
      3
    )}`
  );

  if (lshRatio > 0.3) {
    console.log(`⛔ Article REJECTED by LSH (Ratio: ${lshRatio.toFixed(2)})`);
    return false;
  }

  // =========================================================
  // 2️⃣ STAGE 2: Document-Level BERT
  // =========================================================
  const docCheck = await checkDocumentSimilarity(
    generalCache,
    bertService,
    articleId,
    sentenceText
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
      const paraHash = computeHash(para);

      const embedding = await bertService.getDocumentEmbedding(para);
      tempParaEmbeddings[paraHash] = embedding;

      const match = findBestParagraphMatch(generalCache, embedding, articleId);

      if (match.isDuplicate) {
        console.log(
          `   [PARA] Duplicate found (${match.similarity.toFixed(2)})`
        );
        paraDetections++;
      }
    }
  } else {
    console.log(
      "   ⚠️ Skipping Paragraph Check (BERT disabled or no paragraphs)"
    );
  }

  const paraRatio = paragraphs.length ? paraDetections / paragraphs.length : 0;
  console.log(
    `   [Para Result] Detections: ${paraDetections} | Ratio: ${paraRatio.toFixed(
      3
    )}`
  );

  if (paraRatio > 0.3) {
    console.log(
      `⛔ Article REJECTED by Paragraph Check (Ratio: ${paraRatio.toFixed(2)})`
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
      let embedding = generalCache.sentenceEmbeddings[sentenceHash];

      if (!embedding) {
        embedding = await bertService.getSentenceEmbedding(sentences[i]);
        tempSentenceEmbeddings[sentenceHash] = embedding;
      }

      const bertResult = findFirstBertMatch(generalCache, embedding, articleId);

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
    `\n📊 Final Results: LSH: ${lshDetections} | Para: ${paraDetections} | BERT-Sent: ${bertSentenceDetections}`
  );
  console.log(`   Final Ratio: ${finalRatio.toFixed(3)}`);

  if (finalRatio > 0.3) {
    console.log(`⛔ Article REJECTED (Final Ratio > 0.3)`);
    return false;
  }

  console.log(`\n💾 Storing data...`);

  if (docCheck.embedding) {
    generalCache.documentEmbeddings[articleId] = docCheck.embedding;
  }

  for (const [hash, emb] of Object.entries(tempParaEmbeddings)) {
    generalCache.paragraphEmbeddings[hash] = emb;
  }

  const uniqueHashesToStore = [];
  for (let i = 0; i < sentenceResults.length; i++) {
    const res = sentenceResults[i];
    if (!res.isDuplicate) {
      uniqueHashesToStore.push(res.hash);

      storeSentenceInLSH(
        generalCache,
        res.sentence,
        res.hash,
        res.signature,
        articleId
      );

      if (tempSentenceEmbeddings[res.hash]) {
        generalCache.sentenceEmbeddings[res.hash] =
          tempSentenceEmbeddings[res.hash];
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
      (h) => generalCache.sentences[h] || "[Unknown Sentence]"
    );

    return { sentences, cid };
  } catch (error) {
    console.error(`Failed to fetch article ${articleId}:`, error);
    return null;
  }
}

async function debugPrintCache() {
  const cache = await get("generalCache");
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
