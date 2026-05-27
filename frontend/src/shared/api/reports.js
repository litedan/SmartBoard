import { apiRequest } from "./client";

export async function submitListingReport(listingId, reason = "") {
  return apiRequest("/reports", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId, reason }),
  });
}
