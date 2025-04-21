import { ethers, Contract, utils } from "ethers";
import { CONTRACT_ABI } from "./constants";

const HASH_CACHE_KEY = "hashCache";

function loadHashCache() {
  const stored = localStorage.getItem(HASH_CACHE_KEY);
  return stored ? new Map(JSON.parse(stored)) : new Map();
}

function saveHashCache(cache) {
  localStorage.setItem(
    HASH_CACHE_KEY,
    JSON.stringify(Array.from(cache.entries()))
  );
}

const hashCache = loadHashCache();

// Blockchain setup
const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

const contractAbi = CONTRACT_ABI;

function computeHash(sentence) {
  return utils.keccak256(utils.toUtf8Bytes(sentence));
}

// Scoring function
function computeScore(duplicates) {
  let score = 0;
  let i = 0;
  while (i < duplicates.length) {
    if (!duplicates[i]) {
      i++;
      continue;
    }
    let n = 0;
    while (i < duplicates.length && duplicates[i]) {
      n++;
      i++;
    }
    score += 2 ** (n - 1);
  }
  return score;
}

// Retrieve stored article
async function getStoredArticle(articleId, signer) {
  const contract = new Contract(contractAddress, contractAbi, signer);
  try {
    const hashes = await contract.getArticleHashes(articleId);

    const sentences = hashes.map(
      (h) => hashCache.get(h) || "[Unknown Sentence]"
    );
    return sentences;
  } catch (error) {
    console.error(
      `Failed to fetch sentences for articleId ${articleId}:`,
      error
    );
    return null;
  }
}

// Get total articles
async function getTotalArticles(signerOrProvider) {
  const contract = new Contract(contractAddress, contractAbi, signerOrProvider);
  const total = await contract.totalArticles();
  return total.toNumber();
}

// Process and store article
async function processArticle(articleId, article, signer) {
  const sentences = article.split("\n");

  const sentenceHashes = sentences.map(computeHash);

  const duplicates = sentenceHashes.map((h) => hashCache.has(h));

  for (let i = 0; i < duplicates.length; i++) {
    if (duplicates[i]) {
      console.log(`Duplicate sentence: "${sentences[i]}"`);
    }
  }

  const uniqueHashes = [];
  const uniqueSentences = [];

  for (let i = 0; i < sentenceHashes.length; i++) {
    if (!duplicates[i]) {
      uniqueHashes.push(sentenceHashes[i]);
      uniqueSentences.push(sentences[i]); // store original, not normalized
    }
  }

  const score = computeScore(duplicates);
  const ratio = sentences.length ? score / sentences.length : 0;

  console.log(
    `Article ${articleId}: score=${score}, ratio=${ratio.toFixed(2)}`
  );

  if (ratio > 0.3) {
    console.log(`Article ${articleId} skipped`);
    return false;
  }

  const contract = new Contract(contractAddress, contractAbi, signer);

  try {
    const tx = await contract.storeArticle(articleId, uniqueHashes, {
      gasLimit: 10_000_000,
    });
    await tx.wait();
    console.log(`Stored Article ${articleId}, tx hash: ${tx.hash}`);
  } catch (error) {
    console.error("Blockchain error:", error);
    return false;
  }

  for (let i = 0; i < uniqueHashes.length; i++) {
    hashCache.set(uniqueHashes[i], uniqueSentences[i]);
  }

  // Don't forget to persist the cache
  saveHashCache(hashCache);

  return true;
}

export {
  processArticle,
  getStoredArticle,
  getTotalArticles,
  computeHash,
  provider,
  contractAbi,
  contractAddress,
};
