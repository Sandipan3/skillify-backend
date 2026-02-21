import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  enrollInFreeCourse,
  getEnrollmentCount,
  getMyEnrollments,
  unenrollCourse,
} from "../controllers/enrollmentController.js";
import rateLimit from "../middlewares/rateLimiter.js";

const router = express.Router();

// PUBLIC ROUTE
router.get("/enrollment-count/:id", getEnrollmentCount);

// PROTECTED STUDENT ROUTES
router.use(authMiddleware);

router.post(
  "/enroll-free",
  rateLimit,
  allowedRoles("student"),
  enrollInFreeCourse,
);

router.get("/my-enrollments", allowedRoles("student"), getMyEnrollments);

router.delete("/unenroll/:id", allowedRoles("student"), unenrollCourse);

export default router;
