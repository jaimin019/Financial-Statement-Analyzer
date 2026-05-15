/**
 * Hybrid Search — Combines vector similarity search with MongoDB $text
 * search using Reciprocal Rank Fusion (RRF) to produce a single ranked
 * result list.
 *
 * MANUAL SETUP — MongoDB Text Index on chunks collection
 * Run once in mongosh or Atlas UI:
 *
 *   db.chunks.createIndex({ text: "text" }, { name: "chunk_text_index" })
 *
 * This enables $text search on chunk prose content.
 *
 * --- Why RRF works here ---
 * Vector search finds semantically related concepts even with different
 * wording ("food delivery" finds Swiggy/Zomato chunks).
 * Text search finds exact string matches ("Zepto" finds Zepto).
 * RRF merges both ranked lists without needing to normalize scores
 * across different similarity metrics — rank position is the only
 * currency, making the math simple and robust.
 */

import { Document } from '@langchain/core/documents';
import { similaritySearch } from './vectorStore.js';
import Chunk from '../models/Chunk.js';

const RRF_K = 60;

/**
 * Hybrid search using Reciprocal Rank Fusion of vector + text results.
 *
 * @param {string} sessionId
 * @param {string} query
 * @param {number} [k=8] - Number of final results to return
 * @returns {Promise<import('@langchain/core/documents').Document[]>}
 */
export async function hybridSearch(sessionId, query, k = 8) {
  // Run both searches in parallel
  const [vectorDocs, textResults] = await Promise.all([
    similaritySearch(sessionId, query, k * 2).catch(() => []),
    Chunk.find(
      { $text: { $search: query }, sessionId },
      { score: { $meta: 'textScore' }, text: 1, metadata: 1, sessionId: 1 }
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(k * 2)
      .lean()
      .catch(() => []),
  ]);

  // Map to track RRF scores keyed by document id
  const scoreMap = new Map(); // id → { doc: Document, score: number }

  // Score vector results
  vectorDocs.forEach((doc, rank) => {
    const id = doc.metadata?._id?.toString() ?? `vec-${rank}`;
    const rrfScore = 1 / (RRF_K + rank);
    if (scoreMap.has(id)) {
      scoreMap.get(id).score += rrfScore;
    } else {
      scoreMap.set(id, { doc, score: rrfScore });
    }
  });

  // Score text results
  textResults.forEach((chunk, rank) => {
    const id = chunk._id.toString();
    const rrfScore = 1 / (RRF_K + rank);
    if (scoreMap.has(id)) {
      scoreMap.get(id).score += rrfScore;
    } else {
      // Convert MongoDB chunk doc to LangChain Document
      const langchainDoc = new Document({
        pageContent: chunk.text,
        metadata: { ...chunk.metadata, _id: chunk._id },
      });
      scoreMap.set(id, { doc: langchainDoc, score: rrfScore });
    }
  });

  // Sort by descending RRF score, return top k
  const sorted = [...scoreMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((entry) => entry.doc);

  return sorted;
}
