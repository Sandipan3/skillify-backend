import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  enrollInPaidCourse,
  verifyPaymentAndEnroll,
} from "../controllers/paymentController.js";

const router = express.Router();

// PROTECTED STUDENT ROUTES
router.use(authMiddleware);

router.post("/enroll-paid", allowedRoles("student"), enrollInPaidCourse);
router.post("/verify-payment", allowedRoles("student"), verifyPaymentAndEnroll);

export default router;
