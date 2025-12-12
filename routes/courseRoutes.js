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
  updateCourse,
} from "../controllers/courseController.js";

const router = express.Router();

// ALL ROUTES REQUIRE AUTHENTICATION
router.use(authMiddleware);

// CREATE COURSE (Instructor Only)
// - Uploads: thumbnail + multiple videos
router.post(
  "/create",
  allowedRoles("instructor"),
  uploadMiddleware,
  createCourse
);

// GET PAGINATED COURSES (9 per page)
// GET /course?page=1
router.get("/", getAllCourses);

// GET INSTRUCTOR'S OWN COURSES
router.get("/my-courses", allowedRoles("instructor"), getInstructorCourses);

// GET COURSE BY ID
router.get("/:id", getCourseById);

// UPDATE COURSE (Add videos, update details, replace thumbnail)
// Uploading video/thumbnail is optional
router.put("/:id", allowedRoles("instructor"), uploadMiddleware, updateCourse);

// DELETE ENTIRE COURSE
// Also deletes Cloudinary thumbnail + videos
router.delete("/:id", allowedRoles("instructor"), deleteCourse);

// DELETE A SINGLE VIDEO FROM A COURSE
router.delete(
  "/:courseId/videos/:videoId",
  allowedRoles("instructor"),
  deleteVideo
);

// REPLACE A SINGLE VIDEO (In-place replacement)
// - uploads new video
// - deletes old Cloudinary asset
// - keeps array order
router.put(
  "/:courseId/videos/:videoId/replace",
  allowedRoles("instructor"),
  uploadMiddleware,
  replaceVideo
);

export default router;
