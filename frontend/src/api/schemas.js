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

export const compareSchemas = async (schemaId1, schemaId2, analysisText) => {
  return apiFetch("/schemas/compare", {
    method: "POST",
    json: { schemaId1, schemaId2, analysisText }
  });
};

export const generateAndCompare = async (input1, workload1, input2, workload2, analysisText) => {
  return apiFetch("/schemas/generate-and-compare", {
    method: "POST",
    json: {
      inputText1: input1,
      workloadType1: workload1,
      inputText2: input2,
      workloadType2: workload2,
      analysisText: analysisText
    }
  });
};

export const compareModels = async (requirement, workload, model1, model2, analysisText) => {
  return apiFetch("/schemas/compare-models", {
    method: "POST",
    json: {
      requirement,
      workloadType: workload,
      model1,
      model2,
      analysisText: analysisText
    }
  });
};
