import { Router } from "express";
import {
  createPickList,
  getAllPickLists,
  getPickListById,
  assignPicker,
  pickItem,
  getEligibleOrders,
  getEligiblePickers,
} from "../controllers/pickList.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all pick list endpoints
router.use(verifyJWT);

router.route("/eligible-orders").get(
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
  getEligibleOrders
);
router.route("/eligible-pickers").get(
  authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER),
  getEligiblePickers
);

// GET /pick-lists - List pick lists (Pickers only see their assigned lists)
// POST /pick-lists - Generate pick list (Admin, Ops Manager, Warehouse Manager)
router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PICKER),
    getAllPickLists
  )
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    createPickList
  );

// GET /pick-lists/:id - View pick list details
router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER, USER_ROLES.WAREHOUSE_MANAGER, USER_ROLES.PICKER),
    getPickListById
  );

// PATCH /pick-lists/:id/assign - Assign picker to pick list
router
  .route("/:id/assign")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    assignPicker
  );

// PATCH /pick-lists/:id/items/:itemId/pick - Pick individual item
router
  .route("/:id/items/:itemId/pick")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.WAREHOUSE_MANAGER,
      USER_ROLES.PICKER
    ),
    pickItem
  );

export default router;
