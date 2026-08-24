import { request } from "./httpClient.js";

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Something went wrong");
  }
  return response.json();
}

export const rideApi = {
  getRide: async (rideId) => {
    const res = await request(`/rides/${rideId}`, {
      method: "GET"
    });
    return handleResponse(res);
  },

  acceptRide: async (rideId) => {
    const res = await request(`/rides/${rideId}/accept`, {
      method: "POST"
    });
    return handleResponse(res);
  },

  startRide: async (rideId, driverId) => {
    const res = await request(`/rides/${rideId}/start`, {
      method: "POST",
      body: JSON.stringify({ driverId })
    });
    return handleResponse(res);
  },

  completeRide: async (rideId, driverId) => {
    const res = await request(`/rides/${rideId}/complete`, {
      method: "POST",
      body: JSON.stringify({ driverId })
    });
    return handleResponse(res);
  },

  updateLocation: async (rideId, driverId, lat, lng) => {
    const res = await request(`/rides/${rideId}/location`, {
      method: "POST",
      body: JSON.stringify({ 
        driverId,
        currentLocation: { lat, lng }
      })
    });
    return handleResponse(res);
  },

  getHistory: async (driverId) => {
    const res = await request(`/rides/driver/${driverId}/history`, {
      method: "GET"
    });
    return handleResponse(res);
  },

  cancelRide: async (rideId, reason) => {
    const res = await request(`/rides/${rideId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    return handleResponse(res);
  }
};
