import Course from "../models/Course.js";
import Enrollment from "../models/Enrollment.js";

// (student) enroll in course
export const enrollInCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.userId;

    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({
        status: "error",
        message: "Course not found",
      });
    }

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      course: courseId,
      student: studentId,
    });

    if (existingEnrollment) {
      return res.status(400).json({
        status: "error",
        message: "Already enrolled in this course",
      });
    }
    // Create enrollment
    const enrollment = new Enrollment({
      course: courseId,
      student: studentId,
    });
    await enrollment.populate("course", "title instructor price thumbnail");
    await enrollment.populate("student", "name email");
    await enrollment.save();

    res.status(201).json({
      status: "success",
      data: enrollment,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

export const getMyEnrollments = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const enrollments = await Enrollment.find({ student: studentId })
      .populate({
        path: "course",
        select: "title thumbnail instructor description ",
        populate: {
          path: "instructor",
          select: "name email",
        },
      })
      .sort({
        createdAt: -1,
      });

    res.status(200).json({
      status: "success",
      data: enrollments,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

// Get enrollment count for a course
export const getEnrollmentCount = async (req, res) => {
  try {
    const courseId = req.params.id;
    const count = await Enrollment.countDocuments({ course: courseId });
    res.status(200).json({
      status: "success",
      data: {
        courseId,
        enrollmentCount: count,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

//unenroll
export const unenrollCourse = async (req, res) => {
  try {
    const courseId = req.params.id;
    const studentId = req.user.userId;

    // Check if enrolled
    const enrollment = await Enrollment.findOne({
      course: courseId,
      student: studentId,
    });

    if (!enrollment) {
      return res.status(404).json({
        status: "error",
        message: "You are not enrolled in this course",
      });
    }

    //unenroll
    await Enrollment.findByIdAndDelete(enrollment._id);

    res.status(200).json({
      status: "success",
      message: "Successfully unenrolled from the course",
      data: {
        courseId,
        unenrolledAt: new Date(),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
