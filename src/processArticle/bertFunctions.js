import DetectionConfig from "../detectionConfig";

const NUM_PROJECTIONS = 32;

export const generateRandomPlanes = async (embeddingSize = 768) => {
  const planes = [];
  for (let i = 0; i < NUM_PROJECTIONS; i++) {
    const plane = new Array(embeddingSize);
    for (let j = 0; j < embeddingSize; j++) {
      plane[j] = Math.random() * 2 - 1;
    }
    planes.push(plane);
  }
  return planes;
};

function computeVectorHash(embedding, randomPlanes) {
  // Logic check
  if (!randomPlanes || randomPlanes?.length === 0) {
    throw new Error("Random planes not initialized in Cache");
  }

  let hash = "";
  for (let i = 0; i < NUM_PROJECTIONS; i++) {
    let dot = 0;
    for (let j = 0; j < embedding?.length; j++) {
      dot += embedding[j] * randomPlanes[i][j];
    }
    hash += dot >= 0 ? "1" : "0";
  }
  return hash;
}

export function addToVectorIndex(lshCache, sentenceHash, embedding) {
  const bucketKey = computeVectorHash(embedding, lshCache.randomPlanes);

  if (!lshCache.vectorIndex.buckets[bucketKey]) {
    lshCache.vectorIndex.buckets[bucketKey] = [];
  }

  lshCache.vectorIndex?.buckets[bucketKey].push({
    hash: sentenceHash,
    embedding: embedding,
  });
}

function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length)
    return 0;

  let dotProduct = 0,
    norm1 = 0,
    norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export function findFirstBertMatch(lshCache, queryEmbedding, currentArticleId) {
  // 1. Calculate which bucket this query belongs to

  const bucketKey = computeVectorHash(queryEmbedding, lshCache.randomPlanes);

  const bucket = lshCache.vectorIndex.buckets[bucketKey];

  if (!bucket || bucket.length === 0) {
    return { isDuplicate: false };
  }

  // 3. Linear scan ONLY inside the bucket (Fast!)
  for (let i = bucket.length - 1; i >= 0; i--) {
    const candidate = bucket[i];
    const candidateArticleId = lshCache.sentenceToArticle[candidate.hash];

    if (candidateArticleId === currentArticleId) continue;

    const similarity = cosineSimilarity(queryEmbedding, candidate.embedding);

    if (similarity >= DetectionConfig.BERT.SENTENCE_THRESHOLD) {
      return {
        isDuplicate: true,
        similarSentenceHash: candidate.hash,
        similarity: similarity,
        matchedSentence: lshCache.sentences[candidate.hash],
        matchedArticleId: candidateArticleId,
      };
    }
  }

  return { isDuplicate: false };
}

export async function checkDocumentSimilarity(
  lshCache,
  bertService,
  articleId,
  articleText
) {
  // If feature disabled, return safe result
  if (!DetectionConfig.BERT.ENABLED || !bertService) {
    return { isDuplicate: false, embedding: null };
  }

  try {
    console.log("👉 STAGE 1: Generating Document Embedding...");

    // 1. Calculate embedding for the CURRENT article
    // We do NOT save it to lshCache yet (wait for acceptance)
    const currentDocEmbedding = await bertService.getDocumentEmbedding(
      articleText
    );

    // 2. Compare against ALL past accepted articles
    for (const [existingId, existingEmbedding] of Object.entries(
      lshCache.documentEmbeddings
    )) {
      // Skip comparing to self (if re-processing)
      if (String(existingId) === String(articleId)) continue;

      const similarity = await bertService.calculateSimilarity(
        currentDocEmbedding,
        existingEmbedding
      );

      if (similarity >= DetectionConfig.BERT.DOCUMENT_THRESHOLD) {
        console.log(`🚨 Document-level duplicate detected!`);
        console.log(`   Similar to Article: ${existingId}`);
        console.log(`   Similarity: ${similarity.toFixed(3)}`);

        return {
          isDuplicate: true,
          similarArticleId: existingId,
          similarity: similarity,
          embedding: currentDocEmbedding, // Return it anyway
        };
      }
    }

    console.log("   ✅ Document-level check passed.");
    return {
      isDuplicate: false,
      embedding: currentDocEmbedding, // Return so we can save it later
    };
  } catch (error) {
    console.error("Document-level check failed:", error);
    return { isDuplicate: false, embedding: null };
  }
}
