import { apiFetch } from "./client";

export const chatWithAgent = async (message, schemaId = null) => {
  const response = await apiFetch("/agent/chat", {
    json: {
      message,
      schemaId,
    },
    method: "POST",
  });
  return response;
};

export const resetAgent = async () => {
  const response = await apiFetch("/agent/reset", {
    method: "POST",
  });
  return response;
};
