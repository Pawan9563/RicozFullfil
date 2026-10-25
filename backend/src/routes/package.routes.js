import { Router } from "express";
import {
  createPackage,
  getAllPackages,
  getPackableOrders,
  getPackageById,
  packItems,
  generatePackingSlip,
} from "../controllers/package.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all package endpoints
router.use(verifyJWT);

// GET /packages/packable-orders - Orders in PICKED status ready for packaging
router
  .route("/packable-orders")
  .get(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER,
      USER_ROLES.PACKER
    ),
    getPackableOrders
  );

// GET /packages - List packages
// POST /packages - Initialize package
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PACKER),
    getAllPackages
  )
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER,
      USER_ROLES.PACKER
    ),
    createPackage
  );

// GET /packages/:id - Package details
router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PACKER),
    getPackageById
  );

// POST /packages/:id/pack - Seal package and record weights
router
  .route("/:id/pack")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER,
      USER_ROLES.PACKER
    ),
    packItems
  );

// GET /packages/:id/packing-slip - Retrieve or print packing slip
router
  .route("/:id/packing-slip")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PACKER),
    generatePackingSlip
  );

export default router;
