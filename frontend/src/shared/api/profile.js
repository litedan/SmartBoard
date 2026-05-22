import { apiRequest } from "./client";

export async function fetchPublicProfile(userId) {
  return apiRequest(`/profile/users/${userId}`);
}
