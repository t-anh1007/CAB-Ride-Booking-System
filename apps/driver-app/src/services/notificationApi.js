import { request } from "./httpClient.js";

async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Something went wrong");
  }
  return response.json();
}

export const notificationApi = {
  getNotifications: async (userId) => {
    const res = await request(`/notifications?userId=${userId}`, {
      method: "GET"
    });
    return handleResponse(res);
  }
};
