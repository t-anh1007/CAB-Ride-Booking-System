import { request } from "./httpClient.js";

// Đóng gói JSON trả về từ response
async function handleResponse(response) {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Something went wrong");
  }
  return response.json();
}

export const authApi = {
  requestOtp: async (phone) => {
    const res = await request("/auth/login/otp/request", {
      method: "POST",
      body: JSON.stringify({
        role: "driver",
        destination: phone,
        channel: "sms"
      })
    });
    return handleResponse(res);
  },

  verifyOtp: async (phone, otp) => {
    const res = await request("/auth/login/otp/verify", {
      method: "POST",
      body: JSON.stringify({
        role: "driver",
        destination: phone,
        code: otp
      })
    });
    return handleResponse(res);
  },

  getMe: async () => {
    const res = await request("/auth/me", {
      method: "GET"
    });
    return handleResponse(res);
  },

  logout: async () => {
    const res = await request("/auth/logout", {
      method: "POST"
    });
    return handleResponse(res);
  }
};
