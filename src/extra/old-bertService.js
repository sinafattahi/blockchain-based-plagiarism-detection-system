/**
 * BERT Service for Browser-based Plagiarism Detection
 * Uses Transformers.js for in-browser BERT embeddings
 */

import { pipeline, env } from "@xenova/transformers";

// Configure Transformers.js
env.allowLocalModels = false; // Use CDN models
env.allowRemoteModels = true;

class BERTService {
  constructor(modelName = "Xenova/all-MiniLM-L6-v2") {
    this.modelName = modelName;
    this.extractor = null;
    this.isInitialized = false;
    this.embeddingCache = new Map(); // In-memory cache for embeddings
    this.maxCacheSize = 10000; // Maximum cached embeddings
  }

  /**
   * Initialize the BERT model
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("✓ BERT already initialized");
      return;
    }

    try {
      console.log("⏳ Loading BERT model...");
      console.log(`   Model: ${this.modelName}`);

      const startTime = performance.now();

      // Load feature extraction pipeline
      this.extractor = await pipeline("feature-extraction", this.modelName, {
        progress_callback: (progress) => {
          if (progress.status === "downloading") {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            console.log(`   Downloading: ${percent}%`);
          }
        },
      });

      const loadTime = performance.now() - startTime;
      console.log(`✓ BERT model loaded in ${(loadTime / 1000).toFixed(2)}s`);

      this.isInitialized = true;

      // Warm-up the model with a dummy sentence
      await this.getSentenceEmbedding("This is a test sentence.");
      console.log("✓ BERT model warmed up and ready");
    } catch (error) {
      console.error("✗ Failed to initialize BERT:", error);
      throw new Error(`BERT initialization failed: ${error.message}`);
    }
  }

  /**
   * Get embedding for a single sentence
   */
  async getSentenceEmbedding(sentence) {
    if (!this.isInitialized) {
      throw new Error("BERT service not initialized. Call initialize() first.");
    }

    // Check cache first
    const cacheKey = this._getCacheKey(sentence);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Get embedding from model
      const output = await this.extractor(sentence, {
        pooling: "mean", // Mean pooling for sentence embedding
        normalize: true, // L2 normalization for cosine similarity
      });

      // Convert to regular array
      const embedding = Array.from(output.data);

      // Cache the embedding
      this._addToCache(cacheKey, embedding);

      return embedding;
    } catch (error) {
      console.error("Error generating sentence embedding:", error);
      throw error;
    }
  }

  /**
   * Get embedding for a document (handles long text)
   */
  async getDocumentEmbedding(text) {
    if (!this.isInitialized) {
      throw new Error("BERT service not initialized");
    }

    try {
      // Split long documents into ;ks
      const maxLength = 512; // BERT token limit
      const words = text.split(/\s+/);

      if (words.length <= maxLength) {
        // Short document, process directly
        return await this.getSentenceEmbedding(text);
      }

      // Long document: chunk and average embeddings
      console.log(`   Document chunking: ${words.length} words → chunks`);

      const chunks = [];
      for (let i = 0; i < words.length; i += maxLength) {
        const chunk = words.slice(i, i + maxLength).join(" ");
        chunks.push(chunk);
      }

      // Get embeddings for all chunks
      const chunkEmbeddings = await Promise.all(
        chunks.map((chunk) => this.getSentenceEmbedding(chunk))
      );

      // Average the embeddings
      const avgEmbedding = this._averageEmbeddings(chunkEmbeddings);

      return avgEmbedding;
    } catch (error) {
      console.error("Error generating document embedding:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
      throw new Error("Invalid embeddings provided");
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same dimension");
    }

    // Cosine similarity: dot product of normalized vectors
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    // If embeddings are already normalized (which they should be), this is just dot product
    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    return similarity;
  }

  /**
   * Batch process multiple sentences
   */
  async batchGetEmbeddings(sentences, batchSize = 10) {
    if (!this.isInitialized) {
      throw new Error("BERT service not initialized");
    }

    const embeddings = [];

    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);

      console.log(
        `   Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          sentences.length / batchSize
        )}`
      );

      const batchEmbeddings = await Promise.all(
        batch.map((sentence) => this.getSentenceEmbedding(sentence))
      );

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * Find most similar sentences from a database
   */
  async findSimilar(
    queryEmbedding,
    candidateEmbeddings,
    topK = 5,
    threshold = 0.4
  ) {
    const similarities = [];

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const similarity = await this.calculateSimilarity(
        queryEmbedding,
        candidateEmbeddings[i]
      );

      if (similarity >= threshold) {
        similarities.push({
          index: i,
          similarity: similarity,
        });
      }
    }

    // Sort by similarity (descending) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }

  /**
   * Cache management
   */
  _getCacheKey(text) {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  _addToCache(key, embedding) {
    // Implement LRU-style cache with size limit
    if (this.embeddingCache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.embeddingCache.keys().next().value;
      this.embeddingCache.delete(firstKey);
    }

    this.embeddingCache.set(key, embedding);
  }

  /**
   * Average multiple embeddings
   */
  _averageEmbeddings(embeddings) {
    if (embeddings.length === 0) {
      throw new Error("No embeddings to average");
    }

    const dim = embeddings[0].length;
    const avgEmbedding = new Array(dim).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }

    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] /= embeddings.length;
    }

    // Normalize the averaged embedding
    let norm = 0;
    for (let i = 0; i < dim; i++) {
      norm += avgEmbedding[i] * avgEmbedding[i];
    }
    norm = Math.sqrt(norm);

    for (let i = 0; i < dim; i++) {
      avgEmbedding[i] /= norm;
    }

    return avgEmbedding;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cacheSize: this.embeddingCache.size,
      maxCacheSize: this.maxCacheSize,
      hitRate: this._cacheHits / (this._cacheHits + this._cacheMisses) || 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.embeddingCache.clear();
    console.log("✓ BERT embedding cache cleared");
  }

  /**
   * Check if initialized
   */
  isReady() {
    return this.isInitialized;
  }
}

// Singleton instance
let bertServiceInstance = null;

/**
 * Get or create BERT service instance
 */
export function getBERTService() {
  if (!bertServiceInstance) {
    bertServiceInstance = new BERTService();
  }
  return bertServiceInstance;
}

export { BERTService };
