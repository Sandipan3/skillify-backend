import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import {
  enrollInCourse,
  getEnrollmentCount,
  getMyEnrollments,
  unenrollCourse,
} from "../controllers/enrollmentController.js";
const router = express.Router();

router.use(authMiddleware);

router.get("/enrollment-count/:id", getEnrollmentCount);

router.post("/enroll", allowedRoles("student"), enrollInCourse);
router.get("/my-enrollments", allowedRoles("student"), getMyEnrollments);
router.delete("/unenroll/:id", allowedRoles("student"), unenrollCourse);

export default router;
