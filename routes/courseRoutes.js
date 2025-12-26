import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import uploadMiddleware from "../middlewares/uploadMiddleware.js";

import {
  createCourse,
  deleteCourse,
  deleteVideo,
  replaceVideo,
  getAllCourses,
  getCourseById,
  getInstructorCourses,
  getStudentCourses,
  updateCourse,
} from "../controllers/courseController.js";

const router = express.Router();

// ALL ROUTES REQUIRE AUTHENTICATION
router.use(authMiddleware);

// CREATE COURSE (Instructor Only)
router.post(
  "/create",
  allowedRoles("instructor"),
  uploadMiddleware,
  createCourse
);

// GET PAGINATED COURSES
router.get("/", getAllCourses);

// GET INSTRUCTOR'S OWN COURSES
router.get("/my-courses", allowedRoles("instructor"), getInstructorCourses);

// GET STUDENT ENROLLED COURSES
router.get("/student-courses", allowedRoles("student"), getStudentCourses);

// GET COURSE BY ID (preview / enrolled / instructor handled in controller)
router.get("/:id", getCourseById);

// UPDATE COURSE
router.put("/:id", allowedRoles("instructor"), uploadMiddleware, updateCourse);

// DELETE ENTIRE COURSE
router.delete("/:id", allowedRoles("instructor"), deleteCourse);

// DELETE A SINGLE VIDEO
router.delete(
  "/:courseId/videos/:videoId",
  allowedRoles("instructor"),
  deleteVideo
);

// REPLACE A SINGLE VIDEO
router.put(
  "/:courseId/videos/:videoId/replace",
  allowedRoles("instructor"),
  uploadMiddleware,
  replaceVideo
);

export default router;
