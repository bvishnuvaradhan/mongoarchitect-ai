import { apiFetch } from "./client";

export const validateAtlasConnection = async (connectionString, databaseName) => {
  return apiFetch("/export/validate-connection", {
    method: "POST",
    json: { connectionString, databaseName }
  });
};

export const exportToAtlas = async (schemaId, connectionString, databaseName) => {
  return apiFetch("/export/to-atlas", {
    method: "POST",
    json: { schemaId, connectionString, databaseName }
  });
};
