import { Router } from "express";
import {
  createWarehouse,
  getAllWarehouses,
  getWarehouseById,
  updateWarehouse,
  deleteWarehouse,
  createWarehouseLocation,
  getWarehouseLocations,
} from "../controllers/warehouse.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all warehouse operations
router.use(verifyJWT);

// GET /warehouses - List all warehouses
// POST /warehouses - Create warehouse (Admin / Super Admin only)
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getAllWarehouses
  )
  .post(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    createWarehouse
  );

// GET /warehouses/:id - Warehouse details
// PUT /warehouses/:id & PATCH /warehouses/:id - Update warehouse (Admin / Super Admin only)
// DELETE /warehouses/:id - Deactivate warehouse (Admin / Super Admin only)
router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getWarehouseById
  )
  .put(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    updateWarehouse
  )
  .patch(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    updateWarehouse
  )
  .delete(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    deleteWarehouse
  );

// Locations under a warehouse
router
  .route("/:warehouseId/locations")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getWarehouseLocations
  )
  .post(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE_MANAGER),
    createWarehouseLocation
  );

export default router;
