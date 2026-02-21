import express from "express";
import {
  login,
  logout,
  refreshToken,
  profile,
  changeRole,
  selectRole,
  googleCallback,
  registerInit,
  verifyRegister,
  resetPassword,
  forgotPassword,
} from "../controllers/authControllers.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import passport from "../middlewares/passport.js";
import rateLimit from "../middlewares/rateLimiter.js";

const router = express.Router();

// AUTH
router.post("/register/init", rateLimit, registerInit);
router.post("/register/verify", rateLimit, verifyRegister);
router.post("/login", rateLimit, login);
router.post("/refresh", refreshToken);

// Logout requires user to be logged in
router.post("/logout", authMiddleware, logout);

// USER
router.get("/profile", authMiddleware, profile);

// ROLE MANAGEMENT
router.post("/select-role", authMiddleware, selectRole);

router.post("/change-role", authMiddleware, allowedRoles("admin"), changeRole);

// GOOGLE AUTH
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

// Callback must come after the Google login URL
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback,
);

// Forgot Password
router.post("/forgot-password", rateLimit, forgotPassword);

// Reset Password
router.post("/reset-password/:token", rateLimit, resetPassword);

export default router;
