import { utils } from "ethers";

// Tokenize sentence into lowercase word shingles
function tokenize(sentence, shingleSize = 3) {
  const words = sentence.toLowerCase().split(/\W+/).filter(Boolean);
  const shingles = [];
  for (let i = 0; i <= words.length - shingleSize; i++) {
    shingles.push(words.slice(i, i + shingleSize).join(" "));
  }
  return shingles;
}

// Hash function using keccak256
function hashShingle(shingle) {
  return parseInt(utils.keccak256(utils.toUtf8Bytes(shingle)).slice(2, 10), 16);
}

// MinHash signature with n hash functions
function computeMinHash(shingles, numHashes = 64) {
  const hashes = Array(numHashes).fill(Infinity);
  for (const shingle of shingles) {
    const h = hashShingle(shingle);
    for (let i = 0; i < numHashes; i++) {
      const combined = (h + i * 7919) % 2 ** 32; // 7919 is a large prime
      hashes[i] = Math.min(hashes[i], combined);
    }
  }
  return hashes;
}

// Jaccard similarity of two MinHash signatures
function jaccard(sigA, sigB) {
  let match = 0;
  for (let i = 0; i < sigA.length; i++) {
    if (sigA[i] === sigB[i]) match++;
  }
  return match / sigA.length;
}

// Exported method for comparing sentences
function isSimilar(sentenceA, sentenceB, threshold = 0.8) {
  const sigA = computeMinHash(tokenize(sentenceA));
  const sigB = computeMinHash(tokenize(sentenceB));
  return jaccard(sigA, sigB) >= threshold;
}

export { isSimilar, computeMinHash, tokenize };
