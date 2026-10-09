import { createContext, useContext, useState } from "react";
import { useAuth } from "./AuthProvider.jsx";

const C = createContext(null);
const vehicleMap = { bike: "bike", standard: "car", premium: "car_plus", suv: "car_plus" };

export function BookingProvider({ children }) {
  const { client, user } = useAuth();
  const [pickup, setPickup] = useState({ lat: 10.7769, lng: 106.7009, label: "Quận 1" });
  const [drop, setDrop] = useState(null);
  const [quote, setQuote] = useState(null);
  const [booking, setBooking] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const fetchQuote = async (vehicleType, route = {}) => {
    const result = await client.post("/pricing/quote", {
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      dropLat: drop.lat,
      dropLng: drop.lng,
      vehicleType,
      destinationAddress: drop.label,
      distanceKm: route.distanceKm,
      durationMin: route.durationMin
    });
    return { ...(result.data || result), vehicleType, receivedAt: Date.now() };
  };

  const requestQuote = async (vehicleType, route = {}) => {
    const next = await fetchQuote(vehicleType, route);
    setQuote(next);
    return next;
  };

  const confirmBooking = async () => {
    const result = await client.post("/bookings", {
      userId: user?.id,
      pickup: { lat: pickup.lat, lng: pickup.lng },
      drop: { lat: drop.lat, lng: drop.lng },
      quoteId: quote?.quoteId,
      vehicleType: vehicleMap[quote?.vehicleType || "standard"]
    }, { idempotent: true });
    setBooking(result.data || result);
    return result.data || result;
  };

  return <C.Provider value={{ pickup, drop, quote, booking, paymentMethod, setPickup, setDrop, setQuote, setPaymentMethod, fetchQuote, requestQuote, confirmBooking }}>{children}</C.Provider>;
}

export const useBooking = () => useContext(C);
