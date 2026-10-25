import React from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth, getRoleDefaultPath } from "../context/AuthContext";

/**
 * RoleRoute Component
 * RBAC route guard enforcing allowedRoles array per route.
 */
export const RoleRoute = ({ allowedRoles = [], children }) => {
  const { user, hasRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Access verification
  if (allowedRoles.length > 0 && !hasRole(...allowedRoles)) {
    return (
      <div
        style={{
          padding: "4rem 2rem",
          textAlign: "center",
          maxWidth: "600px",
          margin: "0 auto",
          color: "var(--text-secondary)",
        }}
      >
        <h2 style={{ color: "var(--danger)", marginBottom: "0.75rem", fontSize: "1.5rem" }}>
          Access Denied
        </h2>
        <p style={{ marginBottom: "1rem" }}>
          Your role (<strong style={{ color: "var(--text-primary)" }}>{user.role}</strong>) does not have permission to access this module.
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
          Required roles: {allowedRoles.join(", ")}
        </p>
        <Link
          to={getRoleDefaultPath(user.role)}
          className="btn btn-primary"
          style={{ display: "inline-block", padding: "0.5rem 1.25rem", textDecoration: "none" }}
        >
          Go to Allowed Workspace
        </Link>
      </div>
    );
  }

  return children;
};

export default RoleRoute;
