import { sendErrorResponse } from "../utils/response.js";

const allowedRoles = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user?.roles || [];

    const hasPermission = roles.some((role) => userRoles.includes(role));

    if (!hasPermission) {
      return sendErrorResponse(res, "Forbidden!", 403);
    }

    next();
  };
};

export default allowedRoles;

/** Single role middleware
const allowedRoles = (...roles) => {
  return (req, res, next) => {
    // admin can access every route
    if (req.user.role === "admin") return next();

    // student/instructor can only access allowed parts
    if (!roles.includes(req.user.role)) {
      return sendErrorResponse(res, "Forbidden!", 403);
    }

    next();
  };
};

export default allowedRoles;
*/
