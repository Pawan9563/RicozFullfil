import { Router } from "express";
import {
  getAnalyticsDashboard,
  getFulfillmentOverview,
  getWarehouseThroughput,
  getOrderFulfillmentTimes,
} from "../controllers/analytics.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Protect all analytics endpoints with JWT authentication
router.use(verifyJWT);

// Fully implemented access gating: Restrict strictly to Super Admin, Admin, and Operations Manager
router.use(
  authorizeRoles(
    USER_ROLES.SUPER_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.OPERATIONS_MANAGER
  )
);

// Primary Command Center Dashboard route
router.route("/dashboard").get(getAnalyticsDashboard);

// Legacy / specialized analytics endpoints (backward compatibility)
router.route("/overview").get(getFulfillmentOverview);
router.route("/throughput").get(getWarehouseThroughput);
router.route("/fulfillment-times").get(getOrderFulfillmentTimes);

export default router;
