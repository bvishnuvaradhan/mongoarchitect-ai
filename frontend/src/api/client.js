const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem("ma_token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers ?? {})
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return response.json();
};
