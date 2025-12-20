import DetectionConfig from "../detectionConfig";
function cosineSimilarity(embedding1, embedding2) {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  // For normalized vectors: cosine similarity = dot product
  let dotProduct = 0;
  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
  }

  return dotProduct;
}

/**
 * Find best BERT match using simple linear search with optimizations
 * This is FASTER than complex indexing for <50k vectors
 */
export function findFirstBertMatch(
  generalCache,
  queryEmbedding,
  currentArticleId
) {
  const embeddings = generalCache.sentenceEmbeddings;
  const sentenceToArticle = generalCache.sentenceToArticle;

  if (!embeddings || Object.keys(embeddings).length === 0) {
    return { isDuplicate: false };
  }

  const startTime = performance.now();

  let bestMatch = {
    isDuplicate: false,
    similarity: 0,
  };

  let checked = 0;
  const threshold = DetectionConfig.BERT.SENTENCE_THRESHOLD;
  const STRONG_MATCH_THRESHOLD = 0.95; // Stop early if we find near-perfect match

  // ✅ Linear search with early termination
  for (const [hash, embedding] of Object.entries(embeddings)) {
    const articleId = sentenceToArticle[hash];

    // Skip same article
    if (articleId === currentArticleId) continue;

    checked++;

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity > bestMatch.similarity) {
      bestMatch = {
        isDuplicate: similarity >= threshold,
        similarity: similarity,
        similarSentenceHash: hash,
        matchedSentence: generalCache.sentences[hash],
        matchedArticleId: articleId,
      };

      // ✅ Early termination: Found strong match
      if (similarity >= STRONG_MATCH_THRESHOLD) {
        console.log(
          `   ⚡ Early stop: Found ${similarity.toFixed(
            3
          )} match after ${checked} checks`
        );
        break;
      }
    }
  }

  const time = performance.now() - startTime;
  console.log(
    `   🔍 BERT checked ${checked} embeddings in ${time.toFixed(0)}ms (${(
      time / checked
    ).toFixed(1)}ms each)`
  );

  return bestMatch;
}

/**
 * Document-level similarity check
 */
export async function checkDocumentSimilarity(
  generalCache,
  bertService,
  articleId,
  articleText
) {
  if (!DetectionConfig.BERT.ENABLED || !bertService) {
    return { isDuplicate: false, embedding: null };
  }

  try {
    console.log("👉 STAGE 1: Document-level BERT check...");
    const startTime = performance.now();

    const currentDocEmbedding = await bertService.getDocumentEmbedding(
      articleText
    );

    // Check against existing documents
    for (const [existingId, existingEmbedding] of Object.entries(
      generalCache.documentEmbeddings
    )) {
      if (String(existingId) === String(articleId)) continue;

      const similarity = await bertService.calculateSimilarity(
        currentDocEmbedding,
        existingEmbedding
      );

      if (similarity >= DetectionConfig.BERT.DOCUMENT_THRESHOLD) {
        console.log(
          `🚨 Document duplicate! Similar to Article ${existingId} (${similarity.toFixed(
            3
          )})`
        );
        return {
          isDuplicate: true,
          similarArticleId: existingId,
          similarity: similarity,
          embedding: currentDocEmbedding,
        };
      }
    }

    const time = performance.now() - startTime;
    console.log(`   ✅ Passed (${time.toFixed(0)}ms)`);

    return {
      isDuplicate: false,
      embedding: currentDocEmbedding,
    };
  } catch (error) {
    console.error("Document check failed:", error);
    return { isDuplicate: false, embedding: null };
  }
}

export function findBestParagraphMatch(generalCache, queryEmbedding) {
  const embeddings = generalCache.paragraphEmbeddings;

  if (!embeddings || Object.keys(embeddings).length === 0) {
    return { isDuplicate: false };
  }

  let bestMatch = { isDuplicate: false, similarity: 0 };
  const threshold = DetectionConfig.BERT.PARAGRAPH_THRESHOLD;

  for (const [hash, embedding] of Object.entries(embeddings)) {
    const similarity = cosineSimilarity(queryEmbedding, embedding);

    if (similarity > bestMatch.similarity) {
      bestMatch = {
        isDuplicate: similarity >= threshold,
        similarity: similarity,
        matchedHash: hash,
      };

      if (similarity > 0.98) break;
    }
  }

  return bestMatch;
}
