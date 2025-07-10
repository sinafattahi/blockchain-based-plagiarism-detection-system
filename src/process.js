import { ethers, Contract, utils } from "ethers";
import { set, get } from "idb-keyval";
import { CONTRACT_ABI } from "./constants";
import { uploadToIPFS, getFromIPFS } from "./services/ipfsService";
import { Buffer } from "buffer";

// LSH Configuration
const NUM_HASH_FUNCTIONS = 32;
const NUM_BANDS = 16;
const BAND_SIZE = NUM_HASH_FUNCTIONS / NUM_BANDS;
const SIMILARITY_THRESHOLD = 0.5; // Similarity threshold

// Cache structure for LSH
let lshCache = {
  bands: {}, // Stores band signatures for quick lookups
  sentences: {}, // Maps hash values to original sentences
  signatureMap: {}, // Maps sentence hash to signature
};

// Statistics tracker for ratios
let ratioStats = {};

// Function to add ratio to statistics
function addRatioToStats(ratio) {
  // Round ratio to 2 decimal places for grouping
  const roundedRatio = Math.round(ratio * 100) / 100;
  const ratioKey = roundedRatio.toFixed(2);

  if (ratioStats[ratioKey]) {
    ratioStats[ratioKey]++;
  } else {
    ratioStats[ratioKey] = 1;
  }
}

// Function to print ratio statistics table
function printRatioStatistics() {
  console.log("\n" + "=".repeat(50));
  console.log("RATIO STATISTICS TABLE");
  console.log("=".repeat(50));
  console.log("Ratio\t\tCount");
  console.log("-".repeat(30));

  // Sort ratios for better display
  const sortedRatios = Object.keys(ratioStats).sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );

  let totalArticles = 0;
  sortedRatios.forEach((ratio) => {
    const count = ratioStats[ratio];
    totalArticles += count;
    console.log(`${ratio}\t\t${count}`);
  });

  console.log("-".repeat(30));
  console.log(`Total Articles: ${totalArticles}`);
  console.log("=".repeat(30));
  console.log(`Total hash functions: ${NUM_HASH_FUNCTIONS}`);
  console.log("=".repeat(30));
  console.log(`Total bands: ${NUM_BANDS}`);
  console.log("=".repeat(30));
  console.log(`similarity threshold: ${SIMILARITY_THRESHOLD}`);
  console.log("=".repeat(30));

  // Additional statistics
  if (sortedRatios.length > 0) {
    const uniqueRatios = new Set(Object.keys(ratioStats));
    const zeroRatioCount = ratioStats["0.00"] || 0;
    const highRatioCount = Object.keys(ratioStats)
      .filter((ratio) => parseFloat(ratio) > 0.3)
      .reduce((sum, ratio) => sum + ratioStats[ratio], 0);

    console.log(`\nAdditional Statistics:`);
    console.log(`- Unique ratio values: ${uniqueRatios.size}`);
    console.log(`- Articles with 0.00 ratio: ${zeroRatioCount}`);
    console.log(`- Articles with ratio > 0.30 (skipped): ${highRatioCount}`);
    console.log(
      `- Articles processed successfully: ${totalArticles - highRatioCount}`
    );
  }
}

// Function to reset statistics
function resetRatioStatistics() {
  ratioStats = {};
  console.log("Ratio statistics reset.");
}

// Function to get current statistics
function getRatioStatistics() {
  return { ...ratioStats };
}

// Save to IndexedDB
const saveCache = async () => {
  await set("lshCache", lshCache);
  await set("ratioStats", ratioStats); // Also save statistics
};

// Load from IndexedDB
const loadCache = async () => {
  const cached = await get("lshCache");
  lshCache = cached || {
    bands: {},
    sentences: {},
    signatureMap: {},
  };

  // Load statistics
  const cachedStats = await get("ratioStats");
  ratioStats = cachedStats || {};
};

// Blockchain setup
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
const contractAbi = CONTRACT_ABI;

// Init function
async function init() {
  await loadCache();
}

// Hash a sentence using keccak256 (kept for blockchain compatibility)
function computeHash(sentence) {
  return utils.keccak256(utils.toUtf8Bytes(sentence));
}

// Create shingles (n-grams) from a sentence
function createShingles(sentence, n = 3) {
  const words = sentence
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length < n) return [sentence.toLowerCase()];

  const shingles = [];
  for (let i = 0; i <= words.length - n; i++) {
    shingles.push(words.slice(i, i + n).join(" "));
  }
  return shingles;
}

// Generate a minhash signature for a set of shingles
function generateSignature(shingles) {
  // Simple hash functions based on different prime multipliers
  function hashFunction(i, shingle) {
    const primes = [
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
      71, 73, 79, 83, 89, 97,
    ];
    let hash = 0;
    for (let j = 0; j < shingle.length; j++) {
      hash =
        (hash * primes[i % primes.length] + shingle.charCodeAt(j)) %
        Number.MAX_SAFE_INTEGER;
    }
    return hash;
  }

  const signature = new Array(NUM_HASH_FUNCTIONS).fill(Number.MAX_SAFE_INTEGER);

  shingles.forEach((shingle) => {
    for (let i = 0; i < NUM_HASH_FUNCTIONS; i++) {
      const hashValue = hashFunction(i, shingle);
      signature[i] = Math.min(signature[i], hashValue);
    }
  });

  return signature;
}

// Calculate Jaccard similarity between two signatures
function calculateSimilarity(signature1, signature2) {
  let matchCount = 0;
  for (let i = 0; i < signature1.length; i++) {
    if (signature1[i] === signature2[i]) {
      matchCount++;
    }
  }
  return matchCount / signature1.length;
}

// Get band hashes for a signature
function getBandHashes(signature) {
  const bandHashes = [];

  for (let i = 0; i < NUM_BANDS; i++) {
    const bandValues = signature.slice(i * BAND_SIZE, (i + 1) * BAND_SIZE);
    const bandStr = bandValues.join(",");
    const bandHash = utils.keccak256(utils.toUtf8Bytes(bandStr));
    bandHashes.push(bandHash);
  }

  return bandHashes;
}

// Check if a sentence is similar to any existing sentence
function findSimilarSentences(signature) {
  const bandHashes = getBandHashes(signature);
  const candidateHashes = new Set();

  // Find all candidates that share at least one band
  bandHashes.forEach((bandHash, bandIndex) => {
    if (lshCache.bands[bandIndex] && lshCache.bands[bandIndex][bandHash]) {
      lshCache.bands[bandIndex][bandHash].forEach((hash) => {
        candidateHashes.add(hash);
      });
    }
  });

  // Check similarity with each candidate
  for (const candidateHash of candidateHashes) {
    const candidateSignature = lshCache.signatureMap[candidateHash];
    if (!candidateSignature) continue;

    const similarity = calculateSimilarity(signature, candidateSignature);
    if (similarity >= SIMILARITY_THRESHOLD) {
      return {
        isDuplicate: true,
        similarSentenceHash: candidateHash,
        similarity,
        matchedSentence: lshCache.sentences[candidateHash],
      };
    }
  }

  return { isDuplicate: false };
}

// Store a sentence in the LSH structure
function storeSentenceInLSH(sentence, sentenceHash, signature) {
  // Store sentence
  lshCache.sentences[sentenceHash] = sentence;

  // Store signature
  lshCache.signatureMap[sentenceHash] = signature;

  // Store band hashes for lookup
  const bandHashes = getBandHashes(signature);
  bandHashes.forEach((bandHash, bandIndex) => {
    if (!lshCache.bands[bandIndex]) {
      lshCache.bands[bandIndex] = {};
    }
    if (!lshCache.bands[bandIndex][bandHash]) {
      lshCache.bands[bandIndex][bandHash] = [];
    }
    lshCache.bands[bandIndex][bandHash].push(sentenceHash);
  });
}

// Scoring function
function computeScore(duplicateResults) {
  let score = 0;
  let i = 0;
  while (i < duplicateResults.length) {
    if (!duplicateResults[i].isDuplicate) {
      i++;
      continue;
    }
    let n = 0;
    while (i < duplicateResults.length && duplicateResults[i].isDuplicate) {
      n++;
      i++;
    }
    score += 2 ** (n - 1);
  }
  return score;
}

async function getTotalArticles(signerOrProvider) {
  const contract = new Contract(contractAddress, contractAbi, signerOrProvider);
  const total = await contract.totalArticles();
  return total.toNumber();
}

// Modified processArticle function with ratio tracking
async function processArticle(articleId, article, signer) {
  const sentences = article.split("\n");
  const sentenceHashes = sentences.map(computeHash);

  // Process each sentence with LSH
  const duplicateResults = [];
  const uniqueHashes = [];
  const uniqueSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceHash = sentenceHashes[i];

    // Generate LSH signature
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    // Check for similar sentences
    const result = findSimilarSentences(signature, sentenceHash);
    duplicateResults.push(result);

    if (result.isDuplicate) {
      console.log(
        `Similar sentence found:
      -> New: "${sentence}"
      -> Match: "${result.matchedSentence}"
      -> Similarity: ${result.similarity.toFixed(2)}`
      );
    } else {
      uniqueHashes.push(sentenceHash);
      uniqueSentences.push(sentence);

      // Store in LSH structure
      storeSentenceInLSH(sentence, sentenceHash, signature);
    }
  }

  const score = computeScore(duplicateResults);
  const ratio = sentences.length ? score / sentences.length : 0;

  // Add ratio to statistics
  addRatioToStats(ratio);

  console.log(
    `Article ${articleId}: score=${score}, ratio=${ratio.toFixed(2)}`
  );

  if (ratio > 0.3) {
    console.log(`Article ${articleId} skipped`);
    return false;
  }

  // NEW: Store uniqueHashes to IPFS instead of directly on blockchain
  try {
    // Convert the array of hashes to a JSON string
    const hashesData = JSON.stringify(uniqueHashes);
    // Convert the JSON string to a Buffer for IPFS
    const hashesBuffer = Buffer.from(hashesData);
    // Upload to IPFS
    const ipfsCid = await uploadToIPFS(hashesBuffer);
    console.log(`Stored hashes on IPFS with CID: ${ipfsCid}`);

    // Now store only the CID on the blockchain
    const contract = new Contract(contractAddress, contractAbi, signer);
    const tx = await contract.storeArticleCID(articleId, ipfsCid, {
      gasLimit: 1_000_000, // Reduced gas limit since we're storing less data
    });
    await tx.wait();
    console.log(
      `Stored Article ${articleId} CID on blockchain, tx hash: ${tx.hash}`
    );
  } catch (error) {
    console.error("Error in IPFS/Blockchain storage:", error);
    return false;
  }

  // Save cache to IndexedDB
  await saveCache();
  return true;
}

// Also create a new function to retrieve article hashes from IPFS
async function getStoredArticle(articleId, signer) {
  const contract = new Contract(contractAddress, contractAbi, signer);
  try {
    // Get the CID from the blockchain
    const cid = await contract.getArticleCID(articleId);

    // If there's no CID, return null
    if (!cid || cid === "") {
      console.log(`No CID found for articleId ${articleId}`);
      return null;
    }

    // Retrieve the data from IPFS
    const ipfsData = await getFromIPFS(cid);
    // Convert the Buffer to a string and parse it as JSON
    const hashes = JSON.parse(ipfsData.toString());

    // Convert hashes to sentences
    const sentences = hashes.map(
      (h) => lshCache.sentences[h] || "[Unknown Sentence]"
    );

    // Return both the sentences and the CID
    return {
      sentences,
      cid,
    };
  } catch (error) {
    console.error(
      `Failed to fetch sentences for articleId ${articleId}:`,
      error
    );
    return null;
  }
}

async function debugPrintCache() {
  const cache = await get("lshCache");
  console.log("LSH Cache:", cache);
  return cache;
}

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
  // New exports for ratio statistics
  printRatioStatistics,
  resetRatioStatistics,
  getRatioStatistics,
  addRatioToStats,
};
