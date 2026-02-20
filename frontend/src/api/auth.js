import { apiFetch } from "./client";

export const signup = async (email, password) => {
  return apiFetch("/auth/signup", {
    method: "POST",
    json: { email, password }
  });
};

export const login = async (email, password) => {
  return apiFetch("/auth/login", {
    method: "POST",
    json: { email, password }
  });
};

export const getMe = async () => {
  return apiFetch("/me");
};

export const changePassword = async (currentPassword, newPassword) => {
  return apiFetch("/me/password", {
    method: "PUT",
    json: { currentPassword, newPassword }
  });
};
