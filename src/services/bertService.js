/**
 * BERT Service for Browser-based Plagiarism Detection
 * Uses Transformers.js with paraphrase-detection model
 * Supports both local and remote models
 */

import { pipeline, env, AutoTokenizer } from "@xenova/transformers";

// ✅ Configure Transformers.js for local models
env.allowLocalModels = true; // Enable local models
env.allowRemoteModels = true; // Fallback to remote if local fails
env.localModelPath = "/models/"; // Path to local models folder

class BERTService {
  constructor(
    modelName = "all-mpnet-base-v2", // ✅ Local model name
    useLocalModel = true // ✅ Flag to use local or remote
  ) {
    // Choose model path based on mode
    if (useLocalModel) {
      // Local model (from public/models folder)
      this.modelName = modelName;
      this.modelPath = modelName;
      console.log(`📁 Using local model: ${this.modelPath}`);
    } else {
      // Remote model (from Hugging Face CDN)
      this.modelName = `Xenova/${modelName}`;
      this.modelPath = null;
      console.log(`🌐 Using remote model: ${this.modelName}`);
    }

    this.extractor = null;
    this.tokenizer = null;
    this.isInitialized = false;
    this.embeddingCache = new Map();
    this.maxCacheSize = 10000;
    this.useLocalModel = useLocalModel;
  }

  /**
   * Initialize the BERT model
   * Loads from local folder or falls back to remote
   */
  async initialize() {
    if (this.isInitialized) {
      console.log("✓ BERT already initialized");
      return;
    }

    try {
      console.log("⏳ Loading BERT model...");

      if (this.useLocalModel) {
        console.log(`   📁 Model path: ${this.modelPath}`);
        console.log(`   ⚡ Loading from local filesystem (instant!)`);
      } else {
        console.log(`   🌐 Model: ${this.modelName}`);

        // Check if model is cached in IndexedDB
        const cacheStatus = await this.checkModelCache();
        if (cacheStatus) {
          console.log("   ✓ Loading from browser cache (fast!)");
        } else {
          console.log("   ⚠️  First download - will be cached for future use");
        }
      }

      const startTime = performance.now();

      // Load tokenizer
      const tokenizerPath = this.useLocalModel
        ? this.modelPath
        : this.modelName;
      this.tokenizer = await AutoTokenizer.from_pretrained(tokenizerPath);

      // Load feature extraction pipeline
      const pipelinePath = this.useLocalModel ? this.modelPath : this.modelName;
      this.extractor = await pipeline("feature-extraction", pipelinePath, {
        progress_callback: (progress) => {
          if (progress.status === "downloading") {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            console.log(`   Downloading: ${percent}%`);
          } else if (progress.status === "loading") {
            console.log(`   Loading...`);
          }
        },
      });

      // Mark as initialized BEFORE warmup to avoid recursion
      this.isInitialized = true;

      // Warmup the model with a dummy sentence
      try {
        await this.extractor("This is a warmup sentence.", {
          pooling: "mean",
          normalize: true,
        });
        console.log("   ✓ Model warmed up");
      } catch (err) {
        console.warn("   ⚠️  Warmup skipped:", err);
      }

      const loadTime = performance.now() - startTime;
      console.log(`✓ BERT model ready in ${(loadTime / 1000).toFixed(2)}s`);

      if (!this.useLocalModel) {
        // Show cache size only for remote models
        await this.getCacheSize();
      }
    } catch (error) {
      console.error("✗ Failed to initialize BERT:", error);
      this.isInitialized = false;

      // If local model fails, suggest fallback
      if (this.useLocalModel) {
        console.error(
          "💡 Tip: Make sure model files are in public/models/ folder"
        );
        console.error(
          "   Or set useLocalModel=false to download from internet"
        );
      }

      throw new Error(`BERT initialization failed: ${error.message}`);
    }
  }

  /**
   * Check if model is in browser cache
   */
  async checkModelCache() {
    try {
      const dbName = "transformers-cache";
      const request = indexedDB.open(dbName);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const db = request.result;
          const hasCache = db.objectStoreNames.length > 0;
          db.close();
          resolve(hasCache);
        };
        request.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Get browser cache size
   */
  async getCacheSize() {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        const usageMB = (estimate.usage / 1024 / 1024).toFixed(2);
        const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
        console.log(`   📦 Cache: ${usageMB} MB / ${quotaMB} MB`);
      }
    } catch (err) {
      // Silently fail if not supported
      console.warn("   ⚠️  Unable to get cache size:", err);
    }
  }

  /**
   * Get embedding for a single sentence
   * ✅ Uses SHA-256 hash for better cache keys
   */
  async getSentenceEmbedding(sentence) {
    if (!this.isInitialized) {
      throw new Error("BERT service not initialized. Call initialize() first.");
    }

    // Check cache first using secure hash
    const cacheKey = await this._hashText(sentence);
    if (this.embeddingCache.has(cacheKey)) {
      return this.embeddingCache.get(cacheKey);
    }

    try {
      // Get embedding from model with mean pooling and normalization
      const output = await this.extractor(sentence, {
        pooling: "mean", // Mean pooling for sentence embedding
        normalize: true, // L2 normalization (important for cosine similarity)
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
   * ✅ Uses token-based chunking for better accuracy
   */
  async getDocumentEmbedding(text) {
    if (!this.isInitialized) {
      throw new Error("BERT service not initialized");
    }

    try {
      // Chunk text by tokens (proper way)
      const chunks = await this._chunkTextByTokens(text, 512);

      if (chunks.length === 1) {
        // Short document, process directly
        return await this.getSentenceEmbedding(chunks[0]);
      }

      // Long document: get embeddings for all chunks
      console.log(`   📄 Document chunking: ${chunks.length} chunks`);

      const chunkEmbeddings = await Promise.all(
        chunks.map((chunk) => this.getSentenceEmbedding(chunk))
      );

      // Average the embeddings
      return this._averageEmbeddings(chunkEmbeddings);
    } catch (error) {
      console.error("Error generating document embedding:", error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * ✅ Optimized: assumes embeddings are already normalized
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2) {
      throw new Error("Invalid embeddings provided");
    }

    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same dimension");
    }

    // Since embeddings are normalized, cosine similarity = dot product
    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    return dotProduct;
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
    threshold = 0.7 // ✅ Higher threshold for paraphrase model
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
   * Chunk text by tokens (proper method)
   * ✅ Uses tokenizer to respect model's token limits
   */
  async _chunkTextByTokens(text, maxTokens = 512) {
    if (!this.tokenizer) {
      throw new Error("Tokenizer not initialized");
    }

    // Encode text to tokens
    const tokens = await this.tokenizer.encode(text);
    const chunks = [];

    // Split tokens into chunks
    for (let i = 0; i < tokens.length; i += maxTokens) {
      const tokenSlice = tokens.slice(i, i + maxTokens);
      const decodedChunk = this.tokenizer.decode(tokenSlice);
      chunks.push(decodedChunk);
    }

    return chunks;
  }

  /**
   * Hash text using SHA-256 for better cache keys
   * ✅ More secure than simple hash function
   */
  async _hashText(text) {
    const msgUint8 = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Add embedding to cache (LRU-style)
   */
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
   * Average multiple embeddings and normalize
   */
  _averageEmbeddings(embeddings) {
    if (embeddings.length === 0) {
      throw new Error("No embeddings to average");
    }

    const dim = embeddings[0].length;
    const avgEmbedding = new Array(dim).fill(0);

    // Sum all embeddings
    for (const embedding of embeddings) {
      for (let i = 0; i < dim; i++) {
        avgEmbedding[i] += embedding[i];
      }
    }

    // Average
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
   * Get embedding cache statistics
   */
  getEmbeddingCacheStats() {
    return {
      cacheSize: this.embeddingCache.size,
      maxCacheSize: this.maxCacheSize,
      utilization:
        ((this.embeddingCache.size / this.maxCacheSize) * 100).toFixed(1) + "%",
    };
  }

  /**
   * Clear embedding cache (not model cache)
   */
  clearEmbeddingCache() {
    this.embeddingCache.clear();
    console.log("✓ Embedding cache cleared");
  }

  /**
   * Clear model cache (removes downloaded model from IndexedDB)
   */
  async clearModelCache() {
    try {
      await indexedDB.deleteDatabase("transformers-cache");
      console.log("✓ Model cache cleared - will re-download on next use");
    } catch (error) {
      console.error("Error clearing model cache:", error);
    }
  }

  /**
   * Check if service is ready
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get service info
   */
  getInfo() {
    return {
      modelName: this.modelName,
      modelPath: this.modelPath,
      useLocalModel: this.useLocalModel,
      isInitialized: this.isInitialized,
      embeddingCache: this.getEmbeddingCacheStats(),
    };
  }
}

// Singleton instance
let bertServiceInstance = null;

/**
 * Get or create BERT service instance
 * @param {boolean} useLocalModel - Whether to use local model files
 * @param {string} modelName - Model name (without "Xenova/" prefix for local)
 */
export function getBERTService(
  useLocalModel = true,
  modelName = "all-mpnet-base-v2"
) {
  if (!bertServiceInstance) {
    bertServiceInstance = new BERTService(modelName, useLocalModel);
  }
  return bertServiceInstance;
}

export { BERTService };
