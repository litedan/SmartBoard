import { apiRequest } from "./client";

export async function checkEmailAvailable(email) {
  const params = new URLSearchParams({ email: email.trim() });
  return apiRequest(`/auth/check-email?${params.toString()}`);
}
