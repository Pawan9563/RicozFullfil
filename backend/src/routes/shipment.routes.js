import { Router } from "express";
import {
  createShipment,
  getAllShipments,
  getShipmentById,
  assignCarrier,
  updateShipmentStatus,
  getShipmentTracking,
  simulateNextEvent,
  getActiveCarriers,
} from "../controllers/shipment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all shipment endpoints
router.use(verifyJWT);

router.route("/carriers").get(getActiveCarriers);

// GET /shipments - List shipments
// POST /shipments - Initialize shipment for a packed order
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getAllShipments
  )
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    createShipment
  );

// GET /shipments/:id/tracking - Read tracking events timeline (sorted by timestamp)
router
  .route("/:id/tracking")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getShipmentTracking
  );

// POST /shipments/:id/simulate-next-event - Operational simulator to advance carrier milestones
router
  .route("/:id/simulate-next-event")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    simulateNextEvent
  );

// PATCH /shipments/:id/status - Transition shipment status & record tracking milestone
router
  .route("/:id/status")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    updateShipmentStatus
  );

// PATCH /shipments/:id/carrier - Assign carrier and tracking AWB
router
  .route("/:id/carrier")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    assignCarrier
  );

// GET /shipments/:id - Shipment record details
router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getShipmentById
  );

export default router;
