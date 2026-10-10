import { Navigate, Route, Routes, useLocation, type RouteProps } from "react-router-dom";
import { useAuth } from "./lib/AuthProvider";
import { SplashScreen } from "./screens/SplashScreen";
import { WelcomeScreen } from "./screens/WelcomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { StoryScreen } from "./screens/StoryScreen";
import { SetupScreen } from "./screens/SetupScreen";
import { ReadyScreen } from "./screens/ReadyScreen";
import { AppShell } from "./screens/app/AppShell";

function Loading() {
  return <main className="removed-screen" aria-busy="true" />;
}

/** Requires sign-in; optionally requires a completed setup. */
export function RequireProfile({
  children,
  requireSetup = false,
}: {
  children: React.ReactNode;
  requireSetup?: boolean;
}) {
  const { ready, profile } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!profile) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (requireSetup && !profile.setupComplete) return <Navigate to="/setup" replace />;
  return <>{children}</>;
}

export const routeTable: RouteProps[] = [
  { path: "/", element: <SplashScreen /> },
  { path: "/welcome", element: <WelcomeScreen /> },
  { path: "/login", element: <LoginScreen /> },
  {
    path: "/story",
    element: (
      <RequireProfile>
        <StoryScreen mode="first" />
      </RequireProfile>
    ),
  },
  {
    path: "/setup",
    element: (
      <RequireProfile>
        <SetupScreen />
      </RequireProfile>
    ),
  },
  {
    path: "/ready",
    element: (
      <RequireProfile requireSetup>
        <ReadyScreen />
      </RequireProfile>
    ),
  },
  {
    path: "/app/story",
    element: (
      <RequireProfile requireSetup>
        <StoryScreen mode="watchAgain" />
      </RequireProfile>
    ),
  },
  {
    path: "/app/*",
    element: (
      <RequireProfile requireSetup>
        <AppShell />
      </RequireProfile>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
];

export function AppRoutes() {
  return (
    <Routes>
      {routeTable.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}
