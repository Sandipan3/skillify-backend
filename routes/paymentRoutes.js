import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  enrollInPaidCourse,
  verifyPaymentAndEnroll,
} from "../controllers/paymentController.js";
import rateLimit from "../middlewares/rateLimiter.js";

const router = express.Router();

// PROTECTED STUDENT ROUTES
router.use(authMiddleware);

router.post(
  "/enroll-paid",
  rateLimit,
  allowedRoles("student"),
  enrollInPaidCourse,
);
router.post(
  "/verify-payment",
  rateLimit,
  allowedRoles("student"),
  verifyPaymentAndEnroll,
);

export default router;
