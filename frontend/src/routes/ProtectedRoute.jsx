import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * ProtectedRoute Component Skeleton
 * 50% Scaffolding: Router skeleton wired with useAuth and React Router Outlet.
 * Authentication checks and redirect logic are scaffolded with TODOs for Rico.
 */
export const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // =========================================================================
  // TODO(rico): Implement auth check and redirect logic
  // =========================================================================
  // Hint:
  // 1. While auth state is resolving from storage/network, render loading placeholder:
  //    if (loading) return <div>Loading session...</div>;
  // 2. If user is null (unauthenticated), redirect to /login with state preservation:
  //    if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // 3. Otherwise, render child components via <Outlet />:
  //    return <Outlet />;
  // =========================================================================

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          background: "var(--bg-primary)",
          color: "var(--text-secondary)",
        }}
      >
        <p>Verifying session...</p>
      </div>
    );
  }

  // Scaffold check: Redirect to login if user is not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
