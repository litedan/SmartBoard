import { apiRequest } from "./client";

export async function fetchAds({
  limit = 20,
  offset = 0,
  query = "",
  categoryId = "",
  priceMin = "",
  priceMax = "",
  userId = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (query.trim()) {
    params.set("query", query.trim());
  }
  if (String(categoryId).trim()) {
    params.set("category_id", String(categoryId).trim());
  }
  if (String(priceMin).trim()) {
    params.set("price_min", String(priceMin).trim());
  }
  if (String(priceMax).trim()) {
    params.set("price_max", String(priceMax).trim());
  }
  if (String(userId).trim()) {
    params.set("user_id", String(userId).trim());
  }
  return apiRequest(`/ads?${params.toString()}`);
}

export async function fetchAdById(adId) {
  return apiRequest(`/ads/${adId}`);
}

export async function fetchSimilarAds(adId, { limit = 12 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  return apiRequest(`/ads/${adId}/similar?${params.toString()}`);
}

export async function fetchAdCategories() {
  return apiRequest("/ads/categories");
}

export async function createAd(payload) {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("description", payload.description);
  formData.append("quantity_total", String(payload.quantity_total ?? 1));
  if (payload.price !== null && payload.price !== undefined && payload.price !== "") {
    formData.append("price", String(payload.price));
  }
  if (payload.category_id !== null && payload.category_id !== undefined) {
    formData.append("category_id", String(payload.category_id));
  }
  if (payload.image instanceof File) {
    formData.append("image", payload.image);
  }

  return apiRequest("/ads", {
    method: "POST",
    body: formData,
  });
}

export async function updateAd(adId, payload) {
  const formData = new FormData();
  if (payload.title !== undefined) {
    formData.append("title", payload.title);
  }
  if (payload.description !== undefined) {
    formData.append("description", payload.description);
  }
  if (payload.price !== undefined) {
    formData.append("price", payload.price === null ? "" : String(payload.price));
  }
  if (payload.category_id !== undefined) {
    formData.append("category_id", payload.category_id === null ? "" : String(payload.category_id));
  }
  if (payload.quantity_total !== undefined) {
    formData.append("quantity_total", String(payload.quantity_total));
  }
  if (payload.quantity_available !== undefined) {
    formData.append("quantity_available", String(payload.quantity_available));
  }
  if (payload.is_active !== undefined) {
    formData.append("is_active", payload.is_active ? "true" : "false");
  }
  if (payload.remove_image) {
    formData.append("remove_image", "true");
  }
  if (payload.image instanceof File) {
    formData.append("image", payload.image);
  }
  return apiRequest(`/ads/${adId}`, { method: "PATCH", body: formData });
}

export async function deleteAd(adId) {
  return apiRequest(`/ads/${adId}`, { method: "DELETE" });
}

export async function addFavorite(adId) {
  return apiRequest(`/ads/${adId}/favorite`, { method: "POST" });
}

export async function removeFavorite(adId) {
  return apiRequest(`/ads/${adId}/favorite`, { method: "DELETE" });
}

export async function fetchMyAds({ limit = 100, offset = 0, isActive } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (typeof isActive === "boolean") {
    params.set("is_active", isActive ? "true" : "false");
  }
  return apiRequest(`/ads/my?${params.toString()}`);
}

export async function fetchMyFavorites({ limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiRequest(`/ads/favorites/me?${params.toString()}`);
}

export async function fetchUserListings(userId, { limit = 20, offset = 0 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  return apiRequest(`/ads/users/${userId}/listings?${params.toString()}`);
}
