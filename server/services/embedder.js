import { Embeddings } from '@langchain/core/embeddings';
import pLimit from 'p-limit';
import Chunk from '../models/Chunk.js';

// ── Custom HuggingFace Embeddings (direct API, bypasses Inference Providers) ──

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models';

/**
 * Custom LangChain-compatible embeddings class that calls the
 * HuggingFace Inference API directly (old endpoint) to avoid
 * the Inference Providers permission requirement.
 */
class DirectHFEmbeddings extends Embeddings {
  constructor({ model, apiKey }) {
    super({});
    this.model = model || 'sentence-transformers/all-MiniLM-L6-v2';
    this.apiKey = apiKey;
  }

  /**
   * Calls HuggingFace feature-extraction endpoint for a batch of texts.
   * @param {string[]} texts
   * @returns {Promise<number[][]>}
   */
  async embedDocuments(texts) {
    const response = await fetch(`${HF_API_URL}/${this.model}/pipeline/feature-extraction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HuggingFace API error (${response.status}): ${body}`);
    }

    const result = await response.json();
    // The API returns [[...vector...], [...vector...]] for batch inputs
    return result;
  }

  /**
   * Embeds a single query string.
   * @param {string} text
   * @returns {Promise<number[]>}
   */
  async embedQuery(text) {
    const [vector] = await this.embedDocuments([text]);
    return vector;
  }
}

// ── Singleton embedding instance ────────────────────────────
const embeddings = new DirectHFEmbeddings({
  model: process.env.EMBEDDING_MODEL || 'sentence-transformers/all-MiniLM-L6-v2',
  apiKey: process.env.HUGGINGFACE_API_KEY,
});

const BATCH_SIZE = 32;
const CONCURRENCY = 2;
const EXPECTED_DIMENSIONS = parseInt(process.env.EMBEDDING_DIMENSIONS) || 384;
let dimensionValidated = false;

/**
 * Embeds an array of text strings in controlled batches with
 * concurrency limiting via p-limit.
 *
 * @param {string[]} texts - Array of text strings to embed.
 * @returns {Promise<number[][]>} Array of embedding vectors.
 */
export async function embedTexts(texts) {
  if (texts.length === 0) return [];

  const limit = pLimit(CONCURRENCY);
  const batches = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  const totalBatches = batches.length;
  if (process.env.NODE_ENV === 'development') {
    console.log(`📐 Embedding ${texts.length} texts in ${totalBatches} batches (concurrency: ${CONCURRENCY})`);
  }

  const batchPromises = batches.map((batch, idx) =>
    limit(async () => {
      if (process.env.NODE_ENV === 'development') {
        console.log(`  Embedding batch ${idx + 1} of ${totalBatches}...`);
      }
      const vectors = await embeddings.embedDocuments(batch);

      // Validate embedding dimensions on first successful batch
      if (!dimensionValidated && vectors.length > 0) {
        const actualDim = vectors[0].length;
        if (actualDim !== EXPECTED_DIMENSIONS) {
          console.error(
            `❌ EMBEDDING DIMENSION MISMATCH: model produced ${actualDim}-d vectors, ` +
            `but Atlas Vector Search index expects ${EXPECTED_DIMENSIONS}-d. ` +
            `Update EMBEDDING_DIMENSIONS env var or recreate the index.`
          );
        }
        dimensionValidated = true;
      }

      return vectors;
    })
  );

  const results = await Promise.all(batchPromises);
  return results.flat();
}

/**
 * Embeds a single query string for similarity search.
 *
 * @param {string} text - The query text to embed.
 * @returns {Promise<number[]>} A single embedding vector.
 */
export async function embedQuery(text) {
  return embeddings.embedQuery(text);
}

/**
 * Finds all Chunk documents for a session that lack embeddings,
 * generates embeddings via HuggingFace, and writes them back to MongoDB.
 *
 * @param {string} sessionId - The session to embed chunks for.
 * @returns {Promise<{ embedded: number, skipped: number }>}
 *   Count of newly embedded chunks and already-embedded (skipped) chunks.
 */
export async function embedAndPersistSession(sessionId) {
  const timerLabel = `⏱️  embedAndPersistSession(${sessionId})`;
  if (process.env.NODE_ENV === 'development') console.time(timerLabel);

  try {
    // Find chunks that need embedding
    const chunks = await Chunk.find({
      sessionId,
      $or: [
        { embedding: [] },
        { embedding: { $exists: false } },
      ],
    }).lean();

    const totalChunks = await Chunk.countDocuments({ sessionId });
    const skipped = totalChunks - chunks.length;

    if (chunks.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ Session ${sessionId}: all ${totalChunks} chunks already embedded`);
        console.timeEnd(timerLabel);
      }
      return { embedded: 0, skipped };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 Session ${sessionId}: embedding ${chunks.length} chunks (${skipped} already done)`);
    }

    // Extract texts and embed
    const texts = chunks.map((c) => c.text);
    const vectors = await embedTexts(texts);

    // Bulk-write embeddings back to MongoDB
    const bulkOps = chunks.map((chunk, idx) => ({
      updateOne: {
        filter: { _id: chunk._id },
        update: { $set: { embedding: vectors[idx] } },
      },
    }));

    await Chunk.bulkWrite(bulkOps);

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Session ${sessionId}: embedded ${chunks.length} chunks`);
      console.timeEnd(timerLabel);
    }

    return { embedded: chunks.length, skipped };
  } catch (err) {
    if (process.env.NODE_ENV === 'development') console.timeEnd(timerLabel);
    console.error(`❌ embedAndPersistSession failed for ${sessionId}:`, err.message);
    throw err;
  }
}

export { embeddings };
