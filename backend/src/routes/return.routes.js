import { Router } from "express";
import {
  initiateReturn,
  getAllReturns,
  getReturnById,
  approveReturn,
  scheduleOrUpdatePickup,
  receiveReturn,
  inspectReturn,
  resolveReturn,
} from "../controllers/return.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all return endpoints
router.use(verifyJWT);

// GET /returns - List return requests
// POST /returns - Initiate return request
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getAllReturns
  )
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    initiateReturn
  );

// GET /returns/:id - Return record details
router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
    getReturnById
  );

// PATCH /returns/:id/approve - Role-gated: Operations Manager approves returns
router
  .route("/:id/approve")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    approveReturn
  );

// PATCH /returns/:id/pickup - Pickup scheduling and transit update
router
  .route("/:id/pickup")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    scheduleOrUpdatePickup
  );

// PATCH /returns/:id/receive - Dock receipt of returned goods
router
  .route("/:id/receive")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    receiveReturn
  );

// PATCH /returns/:id/inspect - Role-gated: Warehouse Manager handles technical inspection
router
  .route("/:id/inspect")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    inspectReturn
  );

// PATCH /returns/:id/resolve - Finalize return resolution (Refund or Replacement)
router
  .route("/:id/resolve")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    resolveReturn
  );

export default router;
