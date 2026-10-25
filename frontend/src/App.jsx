import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, getRoleDefaultPath } from "./context/AuthContext";
import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";
import AppLayout from "./components/layout/AppLayout";

// Pages
import Login from "./pages/Login/Login";
import Dashboard from "./pages/Dashboard/Dashboard";
import Orders from "./pages/Orders/Orders";
import OrderDetails from "./pages/OrderDetails/OrderDetails";
import Inventory from "./pages/Inventory/Inventory";
import Warehouses from "./pages/Warehouses/Warehouses";
import PickLists from "./pages/PickLists/PickLists";
import Packing from "./pages/Packing/Packing";
import Shipments from "./pages/Shipments/Shipments";
import ShipmentTracking from "./pages/ShipmentTracking/ShipmentTracking";
import Returns from "./pages/Returns/Returns";
import Analytics from "./pages/Analytics/Analytics";
import UserManagement from "./pages/UserManagement/UserManagement";

import "./App.css";

/**
 * Route component that redirects authenticated users to their role-specific landing page
 */
const RoleHomeRedirect = () => {
  const { user } = useAuth();
  return <Navigate to={getRoleDefaultPath(user?.role)} replace />;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes wrapped with Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<RoleHomeRedirect />} />
              <Route
                path="/dashboard"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"]}>
                    <Dashboard />
                  </RoleRoute>
                }
              />

              {/* Order Lifecycle Routes */}
              <Route
                path="/orders"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <Orders />
                  </RoleRoute>
                }
              />
              <Route
                path="/orders/:id"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <OrderDetails />
                  </RoleRoute>
                }
              />

              {/* Inventory & Warehouse Routes */}
              <Route
                path="/inventory"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <Inventory />
                  </RoleRoute>
                }
              />
              <Route
                path="/warehouses"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <Warehouses />
                  </RoleRoute>
                }
              />

              {/* Picking & Packing Station Routes */}
              <Route
                path="/pick-lists"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER", "PICKER"]}>
                    <PickLists />
                  </RoleRoute>
                }
              />
              <Route
                path="/packing"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "WAREHOUSE_MANAGER", "PACKER"]}>
                    <Packing />
                  </RoleRoute>
                }
              />

              {/* Shipments & Tracking Routes */}
              <Route
                path="/shipments"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <Shipments />
                  </RoleRoute>
                }
              />
              <Route
                path="/shipments/:id/tracking"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <ShipmentTracking />
                  </RoleRoute>
                }
              />

              {/* Reverse Logistics Routes */}
              <Route
                path="/returns"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "WAREHOUSE_MANAGER"]}>
                    <Returns />
                  </RoleRoute>
                }
              />

              {/* Analytics & Metrics Routes */}
              <Route
                path="/analytics"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"]}>
                    <Analytics />
                  </RoleRoute>
                }
              />

              {/* Administration Routes */}
              <Route
                path="/users"
                element={
                  <RoleRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
                    <UserManagement />
                  </RoleRoute>
                }
              />
            </Route>
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<RoleHomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
