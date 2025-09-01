import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/User.js";
dotenv.config();

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ status: "error", message: "No access token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const user = await User.findById(decoded.userId).select("name role");

    if (!user) {
      return res
        .status(401)
        .json({ status: "error", message: "User not found" });
    }

    req.user = {
      userId: decoded.userId,
      name: user.name,
      role: user.role,
    };

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ status: "error", message: "Invalid or expired access token" });
  }
};

export default authMiddleware;
