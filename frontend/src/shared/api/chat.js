import { apiRequest } from "./client";

export async function fetchConversations() {
  return apiRequest("/chat/conversations");
}

export async function createConversationByListing(listingId) {
  return apiRequest(`/chat/conversations/by-listing/${listingId}`, { method: "POST" });
}

export async function fetchConversationMessages(conversationId, { limit = 50, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiRequest(`/chat/conversations/${conversationId}/messages?${params.toString()}`);
}

export async function sendMessage(conversationId, text) {
  return apiRequest(`/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function markConversationRead(conversationId) {
  return apiRequest(`/chat/conversations/${conversationId}/read`, { method: "POST" });
}
