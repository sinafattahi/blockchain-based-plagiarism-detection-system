import { ethers, Contract, utils } from "ethers";
import { set, get } from "idb-keyval";
import { CONTRACT_ABI } from "../constants";
import { uploadToIPFS, getFromIPFS } from "../services/ipfsService";
import { Buffer } from "buffer";

// LSH Configuration - Optimized for better similarity detection
const NUM_HASH_FUNCTIONS = 20;
const NUM_BANDS = 10;
const BAND_SIZE = NUM_HASH_FUNCTIONS / NUM_BANDS;
const SIMILARITY_THRESHOLD = 0.4;

// Cache structure for LSH
let lshCache = {
  bands: {},
  sentences: {},
  signatureMap: {},
};

// Statistics tracker for ratios
let ratioStats = {};

// Function to add ratio to statistics
function addRatioToStats(ratio) {
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
  await set("ratioStats", ratioStats);
};

// Load from IndexedDB
const loadCache = async () => {
  const cached = await get("lshCache");
  lshCache = cached || {
    bands: {},
    sentences: {},
    signatureMap: {},
  };

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

// Hash a sentence using keccak256
function computeHash(sentence) {
  return utils.keccak256(utils.toUtf8Bytes(sentence));
}

// Improved normalization function
function normalizeSentence(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

// Optimized shingle creation for better similarity detection
function createShingles(sentence) {
  const normalized = normalizeSentence(sentence);
  const words = normalized.split(/\s+/).filter((word) => word.length > 0);

  const shingles = new Set();

  // Reduced stop words list for better content preservation
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

  // Add meaningful individual words (increased threshold)
  words.forEach((word) => {
    if (word.length > 2 && !stopWords.has(word)) {
      shingles.add(word);
    }
  });

  // Add 2-grams (most important for similarity)
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + " " + words[i + 1];
    shingles.add(bigram);
  }

  // Add 3-grams for longer sentences
  if (words.length >= 3) {
    for (let i = 0; i < words.length - 2; i++) {
      const trigram = words[i] + " " + words[i + 1] + " " + words[i + 2];
      shingles.add(trigram);
    }
  }

  // Reduced character n-grams (less noise)
  if (normalized.length > 10) {
    for (let i = 0; i < normalized.length - 4; i++) {
      const ngram = normalized.substring(i, i + 5);
      // Only add if it contains meaningful content
      if (!/^\s*$/.test(ngram)) {
        shingles.add(ngram);
      }
    }
  }

  return Array.from(shingles);
}

// Improved hash function with better distribution
function generateSignature(shingles) {
  // Reduced prime set for better performance
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
  let bestMatch = { isDuplicate: false };
  let highestSimilarity = 0;

  for (const candidateHash of candidateHashes) {
    const candidateSignature = lshCache.signatureMap[candidateHash];
    if (!candidateSignature) continue;

    const similarity = calculateSimilarity(signature, candidateSignature);

    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      if (similarity >= SIMILARITY_THRESHOLD) {
        bestMatch = {
          isDuplicate: true,
          similarSentenceHash: candidateHash,
          similarity,
          matchedSentence: lshCache.sentences[candidateHash],
        };
      }
    }
  }

  // Debug: always show the best match found
  // if (candidateHashes.size > 0) {
  //   console.log(
  //     `Best similarity found: ${highestSimilarity.toFixed(
  //       3
  //     )} (threshold: ${SIMILARITY_THRESHOLD})`
  //   );
  // }

  return bestMatch;
}

// Store a sentence in the LSH structure
function storeSentenceInLSH(sentence, sentenceHash, signature) {
  lshCache.sentences[sentenceHash] = sentence;
  lshCache.signatureMap[sentenceHash] = signature;

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
  let hasDuplicates = false;
  let i = 0;

  // Process consecutive duplicate runs
  while (i < duplicateResults.length) {
    if (!duplicateResults[i].isDuplicate) {
      i++;
      continue;
    }

    hasDuplicates = true;

    // Count consecutive duplicates
    let n = 0;
    while (i < duplicateResults.length && duplicateResults[i].isDuplicate) {
      n++;
      i++;
    }

    // For consecutive runs, apply exponential formula
    if (n > 1) {
      score += 3 ** (n - 1);
    }
    // For isolated duplicates, just add 1
    else {
      score += 1;
    }
  }

  // If there were duplicates but somehow no score, ensure minimum of 1
  if (hasDuplicates && score === 0) {
    score = 1;
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

  const duplicateResults = [];
  const uniqueHashes = [];
  const uniqueSentences = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceHash = sentenceHashes[i];
    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    const result = findSimilarSentences(signature);
    duplicateResults.push(result);

    if (result.isDuplicate) {
      console.log(
        `Similar sentence found:
      -> New: "${sentence}"
      -> Match: "${result.matchedSentence}"
      -> Similarity: ${result.similarity.toFixed(3)}`
      );
    } else {
      if (!uniqueSentences.includes(sentence)) {
        uniqueSentences.push(sentence);
        uniqueHashes.push(sentenceHash);
      }
    }
  }

  const score = computeScore(duplicateResults);
  const ratio = sentences.length ? score / sentences.length : 0;

  addRatioToStats(ratio);

  console.log(
    `Article ${articleId}: score=${score}, ratio=${ratio.toFixed(2)}`
  );

  if (ratio > 0.3) {
    console.log(`Article ${articleId} skipped`);
    return false;
  }

  for (let i = 0; i < uniqueSentences.length; i++) {
    const sentence = uniqueSentences[i];
    const sentenceHash = uniqueHashes[i];

    const shingles = createShingles(sentence);
    const signature = generateSignature(shingles);

    storeSentenceInLSH(sentence, sentenceHash, signature);
  }

  try {
    const hashesData = JSON.stringify(uniqueHashes);
    const hashesBuffer = Buffer.from(hashesData);
    const ipfsCid = await uploadToIPFS(hashesBuffer);
    console.log(`Stored hashes on IPFS with CID: ${ipfsCid}`);

    const contract = new Contract(contractAddress, contractAbi, signer);
    const tx = await contract.storeArticleCID(articleId, ipfsCid, {
      gasLimit: 1_000_000,
    });
    await tx.wait();
    console.log(
      `Stored Article ${articleId} CID on blockchain, tx hash: ${tx.hash}`
    );
  } catch (error) {
    console.error("Error in IPFS/Blockchain storage:", error);
    return false;
  }

  await saveCache();
  return true;
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
  printRatioStatistics,
  resetRatioStatistics,
  getRatioStatistics,
  addRatioToStats,
};
