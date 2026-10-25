import { Router } from "express";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { USER_ROLES } from "../models/user.model.js";

const router = Router();

// Require authentication for all product endpoints
router.use(verifyJWT);

// GET /products - List/search products
// POST /products - Create product (Admin / Super Admin only)
router
  .route("/")
  .get(getAllProducts)
  .post(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    upload.array("images", 5),
    createProduct
  );

// GET /products/:id - Product details
// PUT /products/:id & PATCH /products/:id - Update product (Admin / Super Admin only)
// DELETE /products/:id - Archive product (Admin / Super Admin only)
router
  .route("/:id")
  .get(getProductById)
  .put(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    upload.array("images", 5),
    updateProduct
  )
  .patch(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    upload.array("images", 5),
    updateProduct
  )
  .delete(
    authorizeRoles(USER_ROLES.SUPER_ADMIN, USER_ROLES.ADMIN),
    deleteProduct
  );

export default router;
