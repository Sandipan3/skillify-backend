import express from "express";
import {
  login,
  logout,
  refreshToken,
  register,
  profile,
} from "../controllers/authControllers.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import rateLimiter from "../middlewares/rateLimiter.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authMiddleware, profile);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

export default router;
