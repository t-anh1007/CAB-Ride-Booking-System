import { isStandaloneMode } from "@/config/runtime.js";
import { env } from "@/config/env.js";

const apiBaseUrl = env.apiBaseUrl;

function createMockResponse(path, options) {
  let data = {
    mock: true,
    method: options.method || "GET",
    path,
    status: "standalone"
  };

  // Mock specific responses
  if (path.includes("/auth/login/otp/verify")) {
    const body = options.body ? JSON.parse(options.body) : {};
    if (body.code === "000000") {
      return new Response(
        JSON.stringify({
          data: null,
          message: "Mã OTP không chính xác"
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 401
        }
      );
    }

    data = {
      accessToken: "mock-standalone-token",
      id: "driver-123",
      account: {
        id: "driver-123",
        phone: "+84900000002",
        role: "driver",
        name: "Mock Driver"
      }
    };
  } else if (path.includes("/reviews") || path.includes("/average")) {
    if (path.includes("/average")) {
      data = {
        averageRating: 4.8,
        totalReviews: 125,
        distribution: { "5": 100, "4": 20, "3": 5, "2": 0, "1": 0 }
      };
    } else {
      data = [
        { id: "rev-1", rating: 5, comment: "Tài xế rất nhiệt tình, lái xe an toàn.", createdAt: new Date().toISOString() },
        { id: "rev-2", rating: 4, comment: "Xe sạch sẽ, đúng giờ.", createdAt: new Date().toISOString() }
      ];
    }
  } else if (path.includes("/ride/user/")) {
    data = [
      { 
        rideId: "ride-h1", 
        pickup: { address: "123 Lê Lợi, Quận 1" }, 
        destination: { address: "456 Nguyễn Huệ, Quận 1" },
        estimatedFare: 45000,
        status: "completed",
        createdAt: new Date().toISOString()
      },
      { 
        rideId: "ride-h2", 
        pickup: { address: "789 Cách Mạng Tháng 8" }, 
        destination: { address: "321 Lý Tự Trọng" },
        estimatedFare: 62000,
        status: "completed",
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ];
  } else if (path.match(/\/driver\/[^\/]+$/)) {
    data = {
      id: "driver-123",
      phone: "+84900000002",
      role: "driver",
      name: "Mock Driver",
      status: "online",
      rating: 4.8,
      totalTrips: 150,
      kycStatus: "approved",
      profile: {
        firstName: "Tài xế",
        lastName: "Cab Mock"
      },
      vehicle: {
        type: "car",
        plateNumber: "51A-123.45"
      }
    };
  } else if (path.includes("/go-online") || path.includes("/go-offline")) {
    data = {
      status: path.includes("/go-online") ? "online" : "offline"
    };
  } else if (path.includes("/ride/")) {
    data = {
      id: "ride-456",
      status: "requested",
      pickup: { address: "123 Main St" },
      destination: { address: "456 Oak Ave" },
      estimatedFare: 50000,
      customer: {
        name: "Jane Doe",
        phone: "+84911111111"
      }
    };
  } else if (path.includes("/location")) {
    data = { success: true };
  }

  return new Response(
    JSON.stringify({
      data: data,
      status: "success"
    }),
    {
      headers: {
        "Content-Type": "application/json"
      },
      status: 200
    }
  );
}

export async function request(path, options = {}) {
  if (isStandaloneMode) {
    return createMockResponse(path, options);
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const savedSession = localStorage.getItem("sessionData");
  if (savedSession) {
    try {
      const { accessToken } = JSON.parse(savedSession);
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    } catch (e) {
      console.error("Failed to parse session from localStorage", e);
    }
  }

  const fetchOptions = {
    ...options,
    headers,
  };

  const response = await fetch(`${apiBaseUrl}${normalizedPath}`, fetchOptions);

  if (response.status === 401) {
    // Dispatch event to handle globally via routing or provider
    window.dispatchEvent(new Event("session-expired"));
    // Optionally remove tokens
    localStorage.removeItem("sessionData");
    localStorage.removeItem("accessToken");
  }

  return response;
}
