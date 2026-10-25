import React from "react";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../ui/StatusBadge";

export const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <header
      style={{
        height: "64px",
        borderBottom: "1px solid var(--border-color)",
        background: "var(--bg-glass)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 2rem",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--primary)" }}>
          RicozFulfil
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", borderLeft: "1px solid var(--border-color)", paddingLeft: "0.75rem" }}>
          Enterprise Fulfillment Suite
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{user.name}</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{user.email}</div>
            </div>
            <StatusBadge status={user.role} />
            <button
              onClick={logout}
              className="btn btn-outline"
              style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", marginLeft: "0.5rem" }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
