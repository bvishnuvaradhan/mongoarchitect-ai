import { apiFetch } from "./client";

export async function simulateQueryLatency(schemaId) {
  return apiFetch(`/query-latency/simulate/${schemaId}`);
}
