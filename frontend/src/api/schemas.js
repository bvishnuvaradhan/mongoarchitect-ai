import { apiFetch } from "./client";

export const generateSchema = async (inputText, workloadType) => {
  return apiFetch("/schemas/generate", {
    method: "POST",
    json: { inputText, workloadType }
  });
};

export const getHistory = async () => {
  return apiFetch("/schemas/history");
};

export const getSchemaById = async (id) => {
  return apiFetch(`/schemas/${id}`);
};

export const refineSchema = async (schemaId, refinementText, workloadType) => {
  return apiFetch("/schemas/refine", {
    method: "POST",
    json: { schemaId, refinementText, workloadType }
  });
};

export const deleteSchema = async (id) => {
  return apiFetch(`/schemas/${id}`, {
    method: "DELETE"
  });
};

export const deleteAllSchemas = async () => {
  return apiFetch("/schemas", {
    method: "DELETE"
  });
};
