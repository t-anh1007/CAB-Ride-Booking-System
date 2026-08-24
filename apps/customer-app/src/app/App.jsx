import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@app/AuthProvider.jsx";
import { RealtimeProvider } from "@app/RealtimeProvider.jsx";
import { BookingProvider } from "@app/BookingProvider.jsx";
import { router } from "@app/router.jsx";

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <BookingProvider>
          <RouterProvider router={router} />
        </BookingProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}
