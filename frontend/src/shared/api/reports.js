import { apiRequest } from "./client";

export async function submitListingReport(listingId, reason = "") {
  return apiRequest("/reports", {
    method: "POST",
    body: JSON.stringify({ listing_id: listingId, reason }),
  });
}

export async function updateReportStatus(reportId, status) {
  return apiRequest(`/admin/reports/${reportId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}
