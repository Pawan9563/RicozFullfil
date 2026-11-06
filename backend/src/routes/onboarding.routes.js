import { Router } from "express";
import {
  submitOnboarding,
  getOnboardingConfig,
  getOnboardings,
  getOnboardingById,
  updateOnboardingStatus,
} from "../controllers/onboarding.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Public routes for prospective enterprise/brand customers
router.route("/").post(submitOnboarding);
router.route("/config").get(getOnboardingConfig);

// Protected routes for internal admin and fulfillment operations teams
router
  .route("/")
  .get(
    verifyJWT,
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER),
    getOnboardings
  );

router
  .route("/:id")
  .get(
    verifyJWT,
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER),
    getOnboardingById
  );

router
  .route("/:id/status")
  .patch(
    verifyJWT,
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN, USER_ROLES.OPERATIONS_MANAGER),
    updateOnboardingStatus
  );

export default router;
