import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@app/AuthProvider.jsx";
import { RealtimeProvider } from "@app/RealtimeProvider.jsx";
import { DriverRideProvider } from "@app/DriverRideProvider.jsx";
import { router } from "@app/router.jsx";

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <DriverRideProvider>
          <RouterProvider router={router} />
        </DriverRideProvider>
      </RealtimeProvider>
    </AuthProvider>
  );
}
