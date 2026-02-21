import { apiFetch } from "./client";

export async function analyzeAccessPatterns(schemaId) {
  return apiFetch(`/access-patterns/analyze/${schemaId}`);
}
