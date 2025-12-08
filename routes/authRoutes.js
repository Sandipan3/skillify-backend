import express from "express";
import {
  login,
  logout,
  refreshToken,
  register,
  profile,
  changeRole,
  selectRole,
} from "../controllers/authControllers.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import passport from "../middlewares/passport.js";
import { googleCallback } from "../controllers/authControllers.js";

const router = express.Router();

// Auth endpoints
router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.post("/refresh", refreshToken);

// User profile
router.get("/profile", authMiddleware, profile);

// Role selection
router.post("/select-role", authMiddleware, selectRole);
router.post("/change-role", authMiddleware, allowedRoles("admin"), changeRole);

// Social Login - Google
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

export default router;
