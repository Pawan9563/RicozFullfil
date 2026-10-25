import { ApiError } from "../utils/ApiError.js";

/**
 * Role-Based Access Control (RBAC) Guard Middleware Factory
 * Restricts an authenticated request to one of the specified roles.
 *
 * @param  {...string} allowedRoles - List of permitted USER_ROLES strings
 * @returns {Function} Express middleware function
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Basic precondition: user must already be authenticated by verifyJWT
    if (!req.user) {
      throw new ApiError(401, "Authentication required prior to role authorization check");
    }

    if (allowedRoles.length === 0 || !allowedRoles.includes(req.user.role)) {
      throw new ApiError(403, `Access denied: role '${req.user.role}' is not authorized`);
    }
    return next();
  };
};
