import React, { createContext, useContext, useState, useEffect } from "react";
import { authAPI } from "../services/api";

/**
 * Route-to-Roles authorization map for frontend route validation
 */
export const ROUTE_ROLE_MAP = {
  "/dashboard": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"],
  "/orders": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  "/inventory": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  "/warehouses": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  "/pick-lists": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER", "PICKER"],
  "/packing": ["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER", "PACKER"],
  "/shipments": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  "/returns": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"],
  "/analytics": ["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"],
  "/users": ["SUPER_ADMIN", "ADMIN"],
};

/**
 * Validates whether a specific path is permitted for a user's role
 */
export const isPathAllowedForRole = (path, role) => {
  if (!role) return false;
  if (role === "SUPER_ADMIN") return true;
  if (!path || path === "/" || path === "/login") return false;

  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_ROLE_MAP)) {
    if (path === routePrefix || path.startsWith(`${routePrefix}/`)) {
      return allowedRoles.includes(role);
    }
  }
  return false;
};

/**
 * Determine the default authorized landing page path for a given role:
 * - SUPER_ADMIN, ADMIN, OPERATIONS_MANAGER -> /dashboard
 * - WAREHOUSE_MANAGER -> /orders
 * - PICKER -> /pick-lists
 * - PACKER -> /packing
 */
export const getRoleDefaultPath = (role) => {
  switch (role) {
    case "PICKER":
      return "/pick-lists";
    case "PACKER":
      return "/packing";
    case "WAREHOUSE_MANAGER":
      return "/orders";
    case "SUPER_ADMIN":
    case "ADMIN":
    case "OPERATIONS_MANAGER":
    default:
      return "/dashboard";
  }
};

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on initial mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authAPI.getCurrentUser();
        const userData = response?.data?.user || response?.data || response?.user;
        if (userData) {
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));
        }
      } catch (err) {
        console.warn("Session expired or invalid, clearing local session:", err?.message || err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Login handler wired directly to authAPI
  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const payload = response?.data || response;
    const loggedUser = payload?.user;
    const accessToken = payload?.accessToken;
    if (!loggedUser || !accessToken) throw new Error("The server returned an incomplete sign-in response.");
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("user", JSON.stringify(loggedUser));
    setUser(loggedUser);
    return loggedUser;
  };

  // Logout handler
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error("Logout API error:", err?.message || err);
    } finally {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      setUser(null);
    }
  };

  // Role validation helper with Super Admin master override
  const hasRole = (...roles) => {
    if (!user) return false;
    if (user.role === "SUPER_ADMIN") return true;
    return roles.includes(user.role);
  };

  /**
   * Determine the default authorized landing page path for a given role
   */
  const defaultPath = getRoleDefaultPath(user?.role);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    hasRole,
    defaultPath,
    getRoleDefaultPath,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
