import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth, getRoleDefaultPath, isPathAllowedForRole } from "../../context/AuthContext";
import Input from "../../components/forms/Input";
import Button from "../../components/forms/Button";

/**
 * Login Page
 * Supports role-aware landing redirects:
 * - SUPER_ADMIN, ADMIN, OPERATIONS_MANAGER -> /dashboard
 * - WAREHOUSE_MANAGER -> /orders
 * - PICKER -> /pick-lists
 * - PACKER -> /packing
 */
export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loggedUser = await login(email, password);
      // Only preserve referral destination if the user's role is actually permitted to access it
      const fromPath = location.state?.from?.pathname;
      const destination =
        fromPath && isPathAllowedForRole(fromPath, loggedUser?.role)
          ? fromPath
          : getRoleDefaultPath(loggedUser?.role);

      navigate(destination, { replace: true });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Failed to sign in. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "radial-gradient(circle at center, rgba(99, 102, 241, 0.15), var(--bg-primary) 70%)",
        padding: "1rem",
      }}
    >
      <div className="card" style={{ maxWidth: "420px", width: "100%", padding: "2.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--primary)" }}>
            RicozFulfil
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginTop: "0.25rem" }}>
            Enterprise Fulfillment Management Portal
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "0.75rem",
              background: "var(--danger-bg)",
              color: "var(--danger)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8125rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email Address"
            id="email"
            type="email"
            placeholder="admin@ricoz.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="primary"
            style={{ width: "100%", marginTop: "1rem" }}
            isLoading={loading}
          >
            Sign In to Terminal
          </Button>
        </form>

        <div
          style={{
            marginTop: "1.5rem",
            paddingTop: "1.25rem",
            borderTop: "1px solid var(--border-color)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
            Looking for enterprise fulfillment solutions?
          </div>
          <Link
            to="/onboarding"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              marginTop: "0.4rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--primary)",
            }}
          >
            <span>Onboard your company with RicozFulfil</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div
          style={{
            marginTop: "1.25rem",
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          Protected by Enterprise Role-Based Access Control
        </div>
      </div>
    </div>
  );
};

export default Login;
