const allowedRoles = (...roles) => {
  return (req, res, next) => {
    //admin can access every route
    if (req.user.role === "admin") return next();

    // student and instructor can only access their part
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: "error",
        message: "Forbidden!",
      });
    }
    next();
  };
};

export default allowedRoles;
