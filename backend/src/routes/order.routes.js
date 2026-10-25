import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// All order operations require authenticated access
router.use(verifyJWT);

// GET /orders - Fetch orders with query filters: status, warehouse, date, customer, page, limit
// POST /orders - Create a new order
router
  .route("/")
  .get(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    getAllOrders
  )
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    createOrder
  );

// GET /orders/:id - Fetch single order details including embedded items and statusHistory
router
  .route("/:id")
  .get(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER
    ),
    getOrderById
  );

// PATCH /orders/:id/status - Transition order status through the order lifecycle state machine
router
  .route("/:id/status")
  .patch(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER,
      USER_ROLES.WAREHOUSE_MANAGER,
      USER_ROLES.PICKER,
      USER_ROLES.PACKER
    ),
    updateOrderStatus
  );

// POST /orders/:id/cancel - Cancel order and release reserved inventory
router
  .route("/:id/cancel")
  .post(
    authorizeRoles(
      USER_ROLES.SUPER_ADMIN,
      USER_ROLES.ADMIN,
      USER_ROLES.OPERATIONS_MANAGER
    ),
    cancelOrder
  );

export default router;
