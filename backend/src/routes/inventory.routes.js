import { Router } from "express";
import {
  getInventoryLevels,
  adjustStock,
  reserveStock,
  releaseStock,
  transferStock,
} from "../controllers/inventory.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all inventory routes
router.use(verifyJWT);

// GET /inventory?warehouse=&lowStock=true - Fetch inventory balances across facilities
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getInventoryLevels
  );

// PATCH /inventory/:id/adjust - Adjust stock for a specific inventory record
router
  .route("/:id/adjust")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    adjustStock
  );

// POST /inventory/adjust - Adjust stock via body payload (productId, warehouseId, adjustmentType, etc.)
router
  .route("/adjust")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    adjustStock
  );

// POST /inventory/reserve - Reserve stock for an order
router
  .route("/reserve")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    reserveStock
  );

// POST /inventory/release - Release reserved stock
router
  .route("/release")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    releaseStock
  );

// POST /inventory/transfer - Transfer stock between warehouses
router
  .route("/transfer")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    transferStock
  );

export default router;
