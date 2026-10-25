import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * Navigation items configuration across all fulfillment modules
 */
const navItems = [
  {
    name: "Dashboard",
    path: "/dashboard",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"],
  },
  {
    name: "Orders",
    path: "/orders",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  },
  {
    name: "Inventory",
    path: "/inventory",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  },
  {
    name: "Warehouses",
    path: "/warehouses",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  },
  {
    name: "Pick Lists",
    path: "/pick-lists",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER", "PICKER"],
  },
  {
    name: "Packing Bench",
    path: "/packing",
    roles: ["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER", "PACKER"],
  },
  {
    name: "Shipments",
    path: "/shipments",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  },
  {
    name: "Returns",
    path: "/returns",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  },
  {
    name: "Analytics",
    path: "/analytics",
    roles: ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"],
  },
  {
    name: "User Management",
    path: "/users",
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
];

/**
 * Sidebar Component
 * Renders only the modules available to the current user.
 */
export const Sidebar = () => {
  const { user, hasRole } = useAuth();

  const allowedNav = navItems.filter((item) => user && hasRole(...item.roles));

  return (
    <aside
      style={{
        width: "260px",
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border-color)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1rem",
      }}
    >
      <div style={{ marginBottom: "2rem", padding: "0 0.75rem" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Navigation
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {allowedNav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              padding: "0.625rem 0.875rem",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: isActive ? "#ffffff" : "var(--text-secondary)",
              background: isActive ? "var(--primary)" : "transparent",
              transition: "all 0.15s ease",
            })}
          >
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
