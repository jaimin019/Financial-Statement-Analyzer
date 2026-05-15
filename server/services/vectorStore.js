/*
  MANUAL SETUP REQUIRED — MongoDB Atlas Vector Search Index
  ---------------------------------------------------------
  1. Open MongoDB Atlas → your cluster → Browse Collections
  2. Select database: process.env.MONGODB_DB_NAME
  3. Select collection: chunks
  4. Click "Search Indexes" tab → "Create Search Index"
  5. Choose "Atlas Vector Search" (not "Atlas Search")
  6. Use JSON editor and paste this definition:

  {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 384,
        "similarity": "cosine"
      },
      {
        "type": "filter",
        "path": "sessionId"
      },
      {
        "type": "filter",
        "path": "metadata.chunkType"
      }
    ]
  }

  7. Name the index exactly: chunk_vector_index
  8. Wait for status to show "Active" before running any queries.
  ---------------------------------------------------------
*/

import { MongoDBAtlasVectorSearch } from '@langchain/mongodb';
import mongoose from 'mongoose';
import { embeddings } from './embedder.js';

/**
 * Returns a MongoDBAtlasVectorSearch instance configured for the chunks collection.
 *
 * NOTE: The sessionId filter is applied at QUERY time via preFilter,
 * not at store creation time. This allows a single store config to serve
 * all sessions while maintaining strict data isolation.
 *
 * @param {string} _sessionId - Unused at store level; documented for clarity.
 * @returns {MongoDBAtlasVectorSearch} Configured vector store instance.
 */
export function getVectorStore(_sessionId) {
  return new MongoDBAtlasVectorSearch(embeddings, {
    collection: mongoose.connection.db.collection('chunks'),
    indexName: process.env.VECTOR_INDEX_NAME || 'chunk_vector_index',
    textKey: 'text',
    embeddingKey: 'embedding',
  });
}

/**
 * Performs a similarity search scoped to a specific session or array of sessions.
 *
 * CRITICAL: The preFilter scoping to sessionId(s) is MANDATORY on every query.
 * This prevents data leakage between users/sessions — a user must never
 * see chunks from another user's uploaded financial data.
 *
 * @param {string|string[]} sessionIdOrIds - The session ID(s) to scope the search to.
 * @param {string} query - The natural language query to search for.
 * @param {number} [k=8] - Number of top results to return.
 * @returns {Promise<import('@langchain/core/documents').Document[]>}
 *   Array of LangChain Document objects with .pageContent and .metadata.
 */
export async function similaritySearch(sessionIdOrIds, query, k) {
  // It's safe to pass the array to getVectorStore since it ignores the param anyway.
  const store = getVectorStore(sessionIdOrIds);
  const filter = Array.isArray(sessionIdOrIds)
    ? { sessionId: { $in: sessionIdOrIds } }
    : { sessionId: { $eq: sessionIdOrIds } };

  const results = await store.similaritySearch(query, k ?? parseInt(process.env.VECTOR_SEARCH_K) ?? 8, {
    preFilter: filter,
  });
  return results;
}

/**
 * Performs a similarity search with cosine similarity scores,
 * scoped to a specific session or array of sessions. Useful for debugging retrieval quality.
 *
 * @param {string|string[]} sessionIdOrIds - The session ID(s) to scope the search to.
 * @param {string} query - The natural language query.
 * @param {number} [k=8] - Number of top results to return.
 * @returns {Promise<[import('@langchain/core/documents').Document, number][]>}
 *   Array of [Document, cosineScore] tuples sorted by relevance.
 */
export async function similaritySearchWithScore(sessionIdOrIds, query, k) {
  const store = getVectorStore(sessionIdOrIds);
  const filter = Array.isArray(sessionIdOrIds)
    ? { sessionId: { $in: sessionIdOrIds } }
    : { sessionId: { $eq: sessionIdOrIds } };

  const results = await store.similaritySearchWithScore(query, k ?? parseInt(process.env.VECTOR_SEARCH_K) ?? 8, {
    preFilter: filter,
  });
  return results;
}
