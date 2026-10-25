import { User, USER_ROLES } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Get all users with optional role filtering and pagination
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 10 } = req.query;

  const query = {};
  if (role) query.role = role;

  const pageNumber = Math.max(1, Number.parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
  const [users, total] = await Promise.all([
    User.find(query).select("-password -refreshToken").populate("assignedWarehouse", "name code").sort({ name: 1 }).skip((pageNumber - 1) * pageSize).limit(pageSize),
    User.countDocuments(query),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, { users, page: pageNumber, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }, "Users fetched successfully"));
});

/**
 * Get specific user by ID
 */
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select("-password -refreshToken").populate("assignedWarehouse");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(new ApiResponse(200, user, "User retrieved successfully"));
});

/**
 * Update user role (Super Admin / Admin only)
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!role) {
    throw new ApiError(400, "Role is required");
  }

  if (!Object.values(USER_ROLES).includes(role)) throw new ApiError(400, "Invalid role");
  const target = await User.findById(id);
  if (!target) throw new ApiError(404, "User not found");
  if (target._id.equals(req.user._id) && role !== target.role) throw new ApiError(400, "You cannot change your own role");
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && (target.role === USER_ROLES.SUPER_ADMIN || role === USER_ROLES.SUPER_ADMIN)) {
    throw new ApiError(403, "Only a Super Admin may manage Super Admin roles");
  }
  target.role = role;
  await target.save();
  const user = await User.findById(target._id).select("-password -refreshToken").populate("assignedWarehouse", "name code");
  return res.status(200).json(new ApiResponse(200, { user }, "User role updated successfully"));
});

/**
 * Toggle user active/inactive status
 */
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) throw new ApiError(404, "User not found");
  if (user._id.equals(req.user._id)) throw new ApiError(400, "You cannot deactivate your own account");
  if (req.user.role !== USER_ROLES.SUPER_ADMIN && user.role === USER_ROLES.SUPER_ADMIN) throw new ApiError(403, "Only a Super Admin may manage a Super Admin account");
  user.isActive = !user.isActive;
  await user.save();
  const safeUser = await User.findById(user._id).select("-password -refreshToken").populate("assignedWarehouse", "name code");
  return res.status(200).json(new ApiResponse(200, { user: safeUser, _id: user._id, isActive: user.isActive }, "User status updated successfully"));
});
