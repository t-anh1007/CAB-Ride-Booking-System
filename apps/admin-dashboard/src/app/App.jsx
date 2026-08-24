import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "@app/AuthProvider.jsx";
import { RealtimeProvider } from "@app/RealtimeProvider.jsx";
import { router } from "@app/router.jsx";

export function App() {
  return (
    <AuthProvider>
      <RealtimeProvider>
        <RouterProvider router={router} />
      </RealtimeProvider>
    </AuthProvider>
  );
}
