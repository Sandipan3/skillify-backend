import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import {
  createCourse,
  deleteCourse,
  deleteVideo,
  getAllCourses,
  updateCourse,
} from "../controllers/courseController.js";
import allowedRoles from "../middlewares/roleMiddleware.js";
import uploadMiddleware from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post(
  "/create",
  allowedRoles("instructor"),
  uploadMiddleware,
  createCourse
);

router.get("/", getAllCourses);
router.put("/:id", allowedRoles("instructor"), uploadMiddleware, updateCourse);
router.delete("/:id", allowedRoles("instructor"), deleteCourse);
router.delete(
  "/:courseId/videos/:videoId",
  allowedRoles("instructor"),
  deleteVideo
);

export default router;
