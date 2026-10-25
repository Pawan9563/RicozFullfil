import { Router } from "express";
import {
  getAllUsers,
  getUserById,
  updateUserRole,
  toggleUserStatus,
} from "../controllers/user.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

router.use(verifyJWT);

router
  .route("/")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    getAllUsers
  );

router
  .route("/:id")
  .get(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    getUserById
  );

router
  .route("/:id/role")
  .patch(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    updateUserRole
  );

router
  .route("/:id/toggle-status")
  .patch(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    toggleUserStatus
  );

export default router;
