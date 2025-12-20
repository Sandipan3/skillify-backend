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
  forgotPassoword,
  resetPassword,
} from "../controllers/authControllers.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import passport from "../middlewares/passport.js";

const router = express.Router();

// AUTH
router.post("/register/init", registerInit);
router.post("/register/verify", verifyRegister);
router.post("/login", login);
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
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback must come after the Google login URL
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  googleCallback
);

// Forgot Password
router.post("/forgot-password", forgotPassoword);

// Reset Password
router.post("/reset-password/:token", resetPassword);

export default router;
