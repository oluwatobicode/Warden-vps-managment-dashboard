import { createBrowserRouter, Navigate } from "react-router";
import { ConsoleLayout } from "../components/layout/ConsoleLayout";
import LoginPage from "../pages/LoginPage";
import SignupPage from "../pages/SignupPage";
import VerifyPage from "../pages/VerifyPage";
import OnboardingPage from "../pages/OnboardingPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import InvitePage from "../pages/InvitePage";
import NotFoundPage from "../pages/NotFoundPage";
import HomePage from "../pages/HomePage";
import { SettingsLayout } from "../components/layout/SettingsLayout";
import ServersPage from "../pages/settings/ServersPage";
import ServerPage from "../pages/settings/ServerPage";
import SshKeysPage from "../pages/settings/SshKeysPage";
import TeamPage from "../pages/settings/TeamPage";
import NotificationsPage from "../pages/settings/NotificationsPage";
import ApiTokensPage from "../pages/settings/ApiTokensPage";
import ProjectsPage from "../pages/ProjectsPage";
import { ProjectLayout } from "../components/layout/ProjectLayout";
import ProjectOverviewPage from "../pages/project/ProjectOverviewPage";
import ServicePage from "../pages/project/ServicePage";
import ProjectVariablesPage from "../pages/project/ProjectVariablesPage";
import ProjectSettingsPage from "../pages/project/ProjectSettingsPage";
import { RedirectIfAuthed, RequireAuth, RequireRole } from "./guards";

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
          { path: "home", element: <HomePage /> },
          { path: "projects", element: <ProjectsPage /> },
          {
            path: "settings",
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="/settings/servers" replace /> },
              { path: "servers", element: <ServersPage /> },
              { path: "servers/:serverId", element: <ServerPage /> },
              { path: "ssh-keys", element: <SshKeysPage /> },
              { path: "team", element: <TeamPage /> },
              { path: "notifications", element: <NotificationsPage /> },
              {
                path: "tokens",
                element: (
                  <RequireRole min="ADMIN">
                    <ApiTokensPage />
                  </RequireRole>
                ),
              },
            ],
          },
        ],
      },

      // Inside a project: sidebar layout, with the selected environment in ?env=
      {
        path: "projects/:projectId",
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: "services/:serviceId", element: <ServicePage /> },
          { path: "variables", element: <ProjectVariablesPage /> },
          { path: "settings", element: <ProjectSettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
