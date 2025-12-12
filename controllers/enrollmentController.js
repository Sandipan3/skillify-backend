import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";

// Helper to invalidate enrollment related cache
const invalidateEnrollmentCache = async (studentId, courseId) => {
  if (studentId) await redis.del(`enrollments:student:${studentId}`);
  if (courseId) await redis.del(`enrollment:count:${courseId}`);
};

// (student) enroll in course
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.userId;

    const course = await Course.findById(courseId);
    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    const existingEnrollment = await Enrollment.findOne({
      course: courseId,
      student: studentId,
    });

    if (existingEnrollment) {
      return sendErrorResponse(res, "Already enrolled in this course", 400);
    }

    const enrollment = new Enrollment({
      course: courseId,
      student: studentId,
    });

    await enrollment.save();
    await enrollment.populate("course", "title instructor price thumbnail");
    await enrollment.populate("student", "name email");

    // Invalidate cache
    await invalidateEnrollmentCache(studentId, courseId);

    return sendSuccessResponse(res, { enrollment }, 201);
  } catch (error) {
    return sendErrorResponse(res, "Enrollment failed", 500);
  }
};

export const getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const key = `enrollments:student:${studentId}`;

    // Read from cache
    const cached = await redis.get(key);
    if (cached) {
      return sendSuccessResponse(res, { enrollments: JSON.parse(cached) }, 200);
    }

    const enrollments = await Enrollment.find({ student: studentId })
      .populate({
        path: "course",
        select: "title thumbnail instructor description",
        populate: {
          path: "instructor",
          select: "name email",
        },
      })
      .sort({ createdAt: -1 });

    // Cache for 300 seconds
    await redis.set(key, JSON.stringify(enrollments), "EX", 300);

    return sendSuccessResponse(res, { enrollments }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//get enrollment count for a course
export const getEnrollmentCount = async (req, res) => {
  try {
    const courseId = req.params.id;
    const key = `enrollment:count:${courseId}`;

    // Read from cache
    const cached = await redis.get(key);
    if (cached) {
      return sendSuccessResponse(res, { ...JSON.parse(cached) }, 200);
    }

    const count = await Enrollment.countDocuments({ course: courseId });
    const responseData = { courseId, enrollmentCount: count };

    // Cache for 300 seconds
    await redis.set(key, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

//unenroll
export const unenrollCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.user.userId;

    const enrollment = await Enrollment.findOne({
      course: courseId,
      student: studentId,
    });

    if (!enrollment) {
      return sendErrorResponse(res, "You are not enrolled in this course", 404);
    }

    await Enrollment.findByIdAndDelete(enrollment._id);

    // Invalidate cache
    await invalidateEnrollmentCache(studentId, courseId);

    return sendSuccessResponse(
      res,
      {
        message: "Successfully unenrolled from the course",
        courseId,
        unenrolledAt: new Date(),
      },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};
