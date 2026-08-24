import { request } from "./httpClient.js";

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Something went wrong fetching reviews");
  }
  return response.json();
}

export const reviewApi = {
  getDriverReviews: async (driverId) => {
    const res = await request(`/api/v1/reviews/driver/${driverId}`, {
      method: "GET"
    });
    return handleResponse(res);
  },

  getDriverAverageRating: async (driverId) => {
    const res = await request(`/api/v1/reviews/driver/${driverId}/average`, {
      method: "GET"
    });
    return handleResponse(res);
  }
};
