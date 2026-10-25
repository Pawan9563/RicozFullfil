import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * JWT Authentication Guard Middleware
 * Verifies access tokens from the authorization header or secure cookie.
 */
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const authorization = req.get("Authorization");
  const token = req.cookies?.accessToken || (authorization?.startsWith("Bearer ") ? authorization.slice(7) : null);
  if (!token) throw new ApiError(401, "Authentication required");
  if (!process.env.ACCESS_TOKEN_SECRET) throw new ApiError(500, "Access token validation is not configured");

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired access token");
  }
  const user = await User.findById(decoded?._id).select("-password -refreshToken");
  if (!user) throw new ApiError(401, "Invalid access token");
  if (!user.isActive) throw new ApiError(403, "User account is inactive");
  req.user = user;
  return next();
});
