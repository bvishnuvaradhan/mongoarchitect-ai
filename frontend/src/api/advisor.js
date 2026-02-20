import { apiFetch } from "./client";

export async function analyzeSchema(schemaId) {
  return apiFetch(`/advisor/analyze/${schemaId}`);
}
