import { ethers, Contract } from "ethers";

// In-memory cache
const hashCache = new Map();

// Blockchain setup
const contractAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");

const contractAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "uint256",
        name: "textId",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "string[]",
        name: "sentences",
        type: "string[]",
      },
    ],
    name: "SentencesStored",
    type: "event",
  },
  {
    inputs: [
      { internalType: "uint256", name: "", type: "uint256" },
      { internalType: "uint256", name: "", type: "uint256" },
    ],
    name: "articles",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "textId", type: "uint256" }],
    name: "getSentences",
    outputs: [{ internalType: "string[]", name: "", type: "string[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    name: "sentenceHashes",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "textId", type: "uint256" },
      { internalType: "string[]", name: "sentences", type: "string[]" },
    ],
    name: "storeSentences",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Hash function
async function computeHash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Scoring
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

// Main function
async function processText(textId, text, signer) {
  const sentences = text.split("\n").filter((s) => s.trim());
  const sentenceHashes = await Promise.all(sentences.map(computeHash));

  const duplicates = sentenceHashes.map((h) => hashCache.has(h));
  const uniqueHashes = sentenceHashes.filter((h, i) => !duplicates[i]);

  const score = computeScore(duplicates);
  const ratio = sentences.length ? score / sentences.length : 0;

  console.log(`Text ${textId}: score=${score}, ratio=${ratio.toFixed(2)}`);

  if (ratio > 0.3) {
    console.log(`Text ${textId} skipped`);
    return false;
  }

  const contract = new Contract(contractAddress, contractAbi, signer);
  try {
    const tx = await contract.storeSentences(textId, sentences, {
      gasLimit: 3_000_000,
    });
    await tx.wait();
    console.log(`Stored Text ${textId}, tx hash: ${tx.hash}`);
  } catch (error) {
    console.error("Blockchain error:", error);
    return false;
  }

  for (const h of uniqueHashes) {
    hashCache.set(h, textId);
  }

  return true;
}

export { processText, provider, contractAbi, contractAddress };
