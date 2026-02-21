/**
 * Cost Estimation API Client
 * 
 * Fetches MongoDB Atlas cost projections and optimization recommendations
 */

import { apiFetch } from './client';

/**
 * Get Atlas cost projection for a schema
 * @param {string} schemaId - The schema ID
 * @returns {Promise} Cost analysis data
 */
export const analyzeCostEstimation = async (schemaId) => {
  return apiFetch(`/cost-estimate/analyze/${schemaId}`);
};
