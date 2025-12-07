import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";

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

    await enrollment.populate("course", "title instructor price thumbnail");
    await enrollment.populate("student", "name email");
    await enrollment.save();

    return sendSuccessResponse(res, { enrollment }, 201);
  } catch (error) {
    return sendErrorResponse(res, "Enrollment failed", 500);
  }
};

export const getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user.userId;

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

    return sendSuccessResponse(res, { enrollments }, 200);
  } catch (error) {
    return sendErrorResponse(res, "Server Error", 500);
  }
};

// Get enrollment count for a course
export const getEnrollmentCount = async (req, res) => {
  try {
    const courseId = req.params.id;
    const count = await Enrollment.countDocuments({ course: courseId });

    return sendSuccessResponse(res, { courseId, enrollmentCount: count }, 200);
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
