import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "@/components/shared/LoadingScreen";

// Guards a portal route: requires an authenticated session whose role
// matches the portal being accessed. While the session is being resolved
// (e.g. right after a refresh) a loading screen is shown instead of either
// the protected content or a premature redirect.
export function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to={role ? `/login/${role}` : "/login"} replace state={{ from: location }} />;
  }

  if (role && user.role !== role) {
    const base = user.role === "customer" ? "/customer" : `/${user.role}/dashboard`;
    return <Navigate to={base} replace />;
  }

  return children;
}

export function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user && user.role) {
    const base = user.role === "customer" ? "/customer" : `/${user.role}/dashboard`;
    return <Navigate to={base} replace />;
  }

  return children;
}
