import { utils } from "ethers";

import DetectionConfig from "../detectionConfig";

// ============================================
// LSH Functions
// ============================================
export function computeHash(sentence) {
  return utils.keccak256(utils.toUtf8Bytes(sentence));
}

export function normalizeSentence(sentence) {
  return sentence
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createShingles(sentence) {
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

export function generateSignature(shingles) {
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

  const signature = new Array(DetectionConfig.LSH.NUM_HASH_FUNCTIONS).fill(
    Number.MAX_SAFE_INTEGER
  );

  shingles.forEach((shingle) => {
    for (let i = 0; i < DetectionConfig.LSH.NUM_HASH_FUNCTIONS; i++) {
      const hashValue = hashFunction(i, shingle);
      signature[i] = Math.min(signature[i], hashValue);
    }
  });

  return signature;
}

export function calculateSimilarity(signature1, signature2) {
  let matchCount = 0;
  for (let i = 0; i < signature1.length; i++) {
    if (signature1[i] === signature2[i]) {
      matchCount++;
    }
  }
  return matchCount / signature1.length;
}

export function getBandHashes(signature) {
  const bandHashes = [];

  for (let i = 0; i < DetectionConfig.LSH.NUM_BANDS; i++) {
    const bandValues = signature.slice(
      (i * DetectionConfig.LSH.NUM_HASH_FUNCTIONS) /
        DetectionConfig.LSH.NUM_BANDS,
      ((i + 1) * DetectionConfig.LSH.NUM_HASH_FUNCTIONS) /
        DetectionConfig.LSH.NUM_BANDS
    );
    const bandStr = bandValues.join(",");
    const bandHash = utils.keccak256(utils.toUtf8Bytes(bandStr));
    bandHashes.push(bandHash);
  }
  return bandHashes;
}

export function storeSentenceInLSH(
  lshCache,
  sentence,
  sentenceHash,
  signature,
  articleId
) {
  lshCache.sentences[sentenceHash] = sentence;
  lshCache.signatureMap[sentenceHash] = signature;
  lshCache.sentenceToArticle[sentenceHash] = articleId;

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

export function findSimilarSentencesLSH(
  lshCache,
  signature,
  currentSentenceHash,
  currentArticleId
) {

  const bandHashes = getBandHashes(signature);
  const candidateHashes = new Set();

  bandHashes.forEach((bandHash, bandIndex) => {
    if (lshCache.bands[bandIndex] && lshCache.bands[bandIndex][bandHash]) {
      lshCache.bands[bandIndex][bandHash].forEach((hash) => {
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
      if (similarity >= DetectionConfig.LSH.SIMILARITY_THRESHOLD) {
        const candidateArticleId = lshCache.sentenceToArticle[candidateHash];
        bestMatch = {
          isDuplicate: true,
          similarSentenceHash: candidateHash,
          similarity,
          matchedSentence: lshCache.sentences[candidateHash],
          matchedArticleId: candidateArticleId,
        };
      }
    }
  }

  return bestMatch;
}
