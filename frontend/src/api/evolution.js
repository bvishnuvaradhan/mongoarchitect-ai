import { apiFetch } from "./client";

export async function getEvolutionTimeline(schemaId, months = 12) {
  return apiFetch(`/evolution/timeline/${schemaId}?months=${months}`);
}
