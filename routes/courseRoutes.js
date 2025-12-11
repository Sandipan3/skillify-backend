import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createCourse,
  deleteCourse,
  deleteVideo,
  getAllCourses,
  getCourseById,
  getInstructorCourses,
  updateCourse,
} from "../controllers/courseController.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import uploadMiddleware from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// ================== CREATE ==================
router.post(
  "/create",
  allowedRoles("instructor"),
  uploadMiddleware,
  createCourse
);

// ================== READ ==================
router.get("/", getAllCourses);

router.get("/my-courses", allowedRoles("instructor"), getInstructorCourses);

router.get("/:id", getCourseById);

// ================== UPDATE ==================
router.put("/:id", allowedRoles("instructor"), uploadMiddleware, updateCourse);

// ================== DELETE ==================
router.delete("/:id", allowedRoles("instructor"), deleteCourse);

router.delete(
  "/:courseId/videos/:videoId",
  allowedRoles("instructor"),
  deleteVideo
);

export default router;
