import { createBrowserRouter, Navigate } from "react-router";
import { ConsoleLayout } from "../components/layout/ConsoleLayout";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import VerifyPage from "../pages/VerifyPage";
import OnboardingPage from "../pages/OnboardingPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import InvitePage from "../pages/InvitePage";
import NotFoundPage from "../pages/NotFoundPage";
import ConsolePlaceholder from "../pages/ConsolePlaceholder";
import { RedirectIfAuthed, RequireAuth } from "./guards";

export const router = createBrowserRouter([
  {
    element: <RedirectIfAuthed />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/onboarding", element: <OnboardingPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },
  { path: "/auth/verify", element: <VerifyPage /> },
  { path: "/invite/:token", element: <InvitePage /> },

  {
    path: "/",
    element: <RequireAuth />,
    children: [
      {
        element: <ConsoleLayout />,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: "home", element: <ConsolePlaceholder title="Home" /> },
          {
            path: "projects",
            element: <ConsolePlaceholder title="Projects" />,
          },
          {
            path: "settings",
            element: <ConsolePlaceholder title="Settings" />,
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
