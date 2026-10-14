import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { Toaster } from "react-hot-toast";
import { queryClient } from "./api/queryClient";
import { AuthProvider } from "./contexts/AuthContext";
import { router } from "./routes/app.routes";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
      {/* Styled like the design's toast: dark pill, bottom centre. */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "var(--color-ink)",
            border: "1px solid var(--color-navb)",
            borderRadius: "14px",
            color: "#fff",
            fontSize: "12.5px",
            padding: "12px 18px",
          },
          success: { iconTheme: { primary: "var(--color-good)", secondary: "var(--color-ink)" } },
          error: { iconTheme: { primary: "var(--color-crit)", secondary: "var(--color-ink)" } },
        }}
      />
    </QueryClientProvider>
  );
}
