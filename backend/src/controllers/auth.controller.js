import { User, USER_ROLES } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};

/**
 * Register a new platform user
 * Validates inputs and creates user in database (pre-save hook hashes password).
 * Public registration is limited to the initial Super Admin bootstrap.
 */
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, assignedWarehouse } = req.body;

  // Basic input validation
  if (!name || !name.trim()) {
    throw new ApiError(400, "Full name is required");
  }

  if (!email || !email.trim()) {
    throw new ApiError(400, "Email address is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    throw new ApiError(400, "Invalid email format");
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password is required and must be at least 6 characters long");
  }

  if (role && !Object.values(USER_ROLES).includes(role)) throw new ApiError(400, "Invalid role");
  if (await User.exists({})) throw new ApiError(403, "Public registration is closed after initial setup");
  if (role && role !== USER_ROLES.SUPER_ADMIN) throw new ApiError(400, "The initial account must be a Super Admin");

  const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, "User with this email already exists");
  }

  // Create user record in DB (pre-save hook automatically handles bcrypt hashing)
  const user = await User.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role: USER_ROLES.SUPER_ADMIN,
    phone: phone ? phone.trim() : undefined,
    assignedWarehouse: assignedWarehouse || undefined,
  });

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return res.status(201).cookie("accessToken", accessToken, cookieOptions).cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(201, { user: { _id: user._id, name: user.name, email: user.email, role: user.role }, accessToken }, "Initial Super Admin registered"));
});

/**
 * User login with email and password
 * Validates inputs and locates user in database.
 * Verifies credentials and rotates the refresh token on session creation.
 */
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Basic input validation
  if (!email || !email.trim()) {
    throw new ApiError(400, "Email address is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new ApiError(401, "Invalid email or password");

  if (!user.isActive) {
    throw new ApiError(403, "This account is inactive. Please contact your system administrator");
  }

  if (!(await user.isPasswordCorrect(password))) throw new ApiError(401, "Invalid email or password");
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return res.status(200).cookie("accessToken", accessToken, cookieOptions).cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { user: { _id: user._id, name: user.name, email: user.email, role: user.role, assignedWarehouse: user.assignedWarehouse ?? null }, accessToken }, "User logged in successfully"));
});

/**
 * Logout authenticated user
 * Revokes the persisted refresh token and clears session cookies.
 */
export const logoutUser = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $unset: { refreshToken: 1 } });

  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

/**
 * Refresh access token using refresh token cookie or body payload
 * Verifies and rotates the refresh token, invalidating the previous token.
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized: Refresh token is required");
  }

  if (!process.env.REFRESH_TOKEN_SECRET) throw new ApiError(500, "Refresh token validation is not configured");
  let decoded;
  try { decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET); }
  catch { throw new ApiError(401, "Invalid or expired refresh token"); }
  const user = await User.findById(decoded?._id);
  if (!user || !user.isActive || user.refreshToken !== incomingRefreshToken) throw new ApiError(401, "Refresh token is expired, invalid, or revoked");
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });
  return res.status(200).cookie("accessToken", accessToken, cookieOptions).cookie("refreshToken", refreshToken, cookieOptions)
    .json(new ApiResponse(200, { accessToken }, "Access token refreshed successfully"));
});

/**
 * Get current authenticated user profile
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user || null, "Current user profile fetched successfully"));
});
