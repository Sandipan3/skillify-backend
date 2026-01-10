import Course from "../models/Course.js";
import cloudinary from "../config/cloudinary.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";
import fs from "fs";
import User from "../models/User.js";
import Enrollment from "../models/Enrollment.js";

// CLOUDINARY HELPERS
// Upload image from memory buffer
export const uploadImageToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (err, res) => (err ? reject(err) : resolve(res))
    );
    stream.end(buffer);
  });
};

// Upload video from TEMP file using streaming
export const uploadVideoToCloudinary = (filePath, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "video",
        chunk_size: 6000000, // 6MB
      },
      (err, res) => {
        fs.existsSync(filePath) && fs.unlinkSync(filePath); // delete temp file
        return err ? reject(err) : resolve(res);
      }
    );

    fs.createReadStream(filePath).pipe(uploadStream);
  });
};

/* 
   CACHE INVALIDATION
   Allowed keys ONLY:
   1. courses:page:*
   2. courses:instructor:<id>:page:*
   3. courses:student:<id>:page:*
 */

const invalidateCourseCache = async (studentId, instructorId) => {
  try {
    const publicKeys = await redis.keys("courses:page:*");
    if (publicKeys.length) await redis.del(publicKeys);

    if (instructorId) {
      const instructorKeys = await redis.keys(
        `courses:instructor:${instructorId}:page:*`
      );
      if (instructorKeys.length) await redis.del(instructorKeys);
    }

    if (studentId) {
      const studentKeys = await redis.keys(
        `courses:student:${studentId}:page:*`
      );
      if (studentKeys.length) await redis.del(studentKeys);
    }
  } catch (err) {
    console.log("CACHE INVALIDATION ERROR", err);
  }
};

// CREATE COURSE (Instructor)
export const createCourse = async (req, res) => {
  const { title, description, price = 0, upiId } = req.body;
  const instructor = req.user.userId;

  if (!title || !description) {
    return sendErrorResponse(res, "Title and description are required", 400);
  }

  if (price > 0) {
    const instructorUser = await User.findById(instructor);
    if (!instructorUser) {
      return sendErrorResponse(res, "Instructor not found", 404);
    }

    if (!instructorUser.upiId) {
      if (!upiId) {
        return sendErrorResponse(
          res,
          "UPI ID is required for paid courses",
          400
        );
      }
      instructorUser.upiId = upiId;
      await instructorUser.save();
    }
  }

  const existingCourse = await Course.findOne({
    title: { $regex: `^${title.trim()}$`, $options: "i" },
  });

  if (existingCourse) {
    return sendErrorResponse(
      res,
      "A course with this title already exists",
      400
    );
  }

  if (!req.files?.thumbnail) {
    return sendErrorResponse(res, "Thumbnail is required", 400);
  }

  if (!req.files?.videos?.length) {
    return sendErrorResponse(res, "At least one video is required", 400);
  }

  let uploadedThumbnail = null;
  let uploadedVideos = [];

  try {
    uploadedThumbnail = await uploadImageToCloudinary(
      req.files.thumbnail[0].buffer,
      "skillify-thumbnails"
    );

    for (const video of req.files.videos) {
      const uploaded = await uploadVideoToCloudinary(
        video.path,
        "skillify-videos"
      );

      uploadedVideos.push({
        title: video.originalname.replace(/\.[^/.]+$/, ""),
        url: uploaded.secure_url,
        public_id: uploaded.public_id,
      });
    }

    const course = await Course.create({
      title,
      description,
      instructor,
      thumbnail: {
        url: uploadedThumbnail.secure_url,
        public_id: uploadedThumbnail.public_id,
      },
      videos: uploadedVideos,
      price,
    });

    await course.populate("instructor", "name");

    await invalidateCourseCache(null, instructor);

    return sendSuccessResponse(res, { course }, 201);
  } catch (error) {
    if (uploadedThumbnail?.public_id) {
      await cloudinary.uploader.destroy(uploadedThumbnail.public_id, {
        resource_type: "image",
      });
    }

    for (const vid of uploadedVideos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    return sendErrorResponse(
      res,
      error.message || "Course creation failed",
      500
    );
  }
};

// GET ALL COURSES (Public, Paginated)
export const getAllCourses = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const cacheKey = `courses:page:${page}`;
    const cached = await redis.get(cacheKey);
    if (cached) return sendSuccessResponse(res, JSON.parse(cached), 200);

    const totalCourses = await Course.countDocuments();
    const totalPages = Math.ceil(totalCourses / limit);

    const courses = await Course.find()
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const responseData = {
      courses,
      page,
      totalPages,
      totalCourses,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// GET COURSE BY ID (Preview / Enrolled / Instructor)
export const getCourseById = async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.userId;
    const roles = req.user.roles || [];

    const course = await Course.findById(courseId).populate(
      "instructor",
      "name email"
    );

    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    const isInstructorOwner =
      roles.includes("instructor") &&
      course.instructor._id.toString() === userId;

    if (isInstructorOwner) {
      return sendSuccessResponse(res, { course }, 200);
    }

    const isEnrolled = await Enrollment.exists({
      student: userId,
      course: courseId,
    });

    if (isEnrolled) {
      const courseObj = course.toObject();
      courseObj.videos = courseObj.videos.map(({ public_id, ...rest }) => rest);
      return sendSuccessResponse(res, { course: courseObj }, 200);
    }

    const previewCourse = {
      _id: course._id,
      title: course.title,
      description: course.description,
      price: course.price,
      thumbnail: course.thumbnail,
      instructor: course.instructor,
      createdAt: course.createdAt,
    };

    return sendSuccessResponse(res, { course: previewCourse }, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// GET INSTRUCTOR COURSES
export const getInstructorCourses = async (req, res) => {
  try {
    const instructorId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const cacheKey = `courses:instructor:${instructorId}:page:${page}`;
    const cached = await redis.get(cacheKey);
    if (cached) return sendSuccessResponse(res, JSON.parse(cached), 200);

    const totalCourses = await Course.countDocuments({
      instructor: instructorId,
    });

    const totalPages = Math.ceil(totalCourses / limit);

    const courses = await Course.find({ instructor: instructorId })
      .populate("instructor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const responseData = {
      courses,
      page,
      totalPages,
      totalCourses,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// GET STUDENT COURSES
export const getStudentCourses = async (req, res) => {
  try {
    const studentId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const cacheKey = `courses:student:${studentId}:page:${page}`;
    const cached = await redis.get(cacheKey);
    if (cached) return sendSuccessResponse(res, JSON.parse(cached), 200);

    const totalCourses = await Enrollment.countDocuments({
      student: studentId,
    });

    const totalPages = Math.ceil(totalCourses / limit);

    const enrollments = await Enrollment.find({ student: studentId })
      .populate({
        path: "course",
        populate: { path: "instructor", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const courses = enrollments.map((e) => e.course);

    const responseData = {
      courses,
      page,
      totalPages,
      totalCourses,
    };

    await redis.set(cacheKey, JSON.stringify(responseData), "EX", 300);

    return sendSuccessResponse(res, responseData, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// UPDATE COURSE
export const updateCourse = async (req, res) => {
  let newThumbnail = null;
  let newVideos = [];

  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const { title, description, price, upiId } = req.body;

    if (title && title.toLowerCase() !== course.title.toLowerCase()) {
      const existingCourse = await Course.findOne({
        title: { $regex: `^${title.trim()}$`, $options: "i" },
      });

      if (existingCourse) {
        return sendErrorResponse(
          res,
          "A course with this title already exists",
          400
        );
      }
    }

    if (req.files?.thumbnail) {
      newThumbnail = await uploadImageToCloudinary(
        req.files.thumbnail[0].buffer,
        "skillify-thumbnails"
      );

      if (course.thumbnail?.public_id) {
        await cloudinary.uploader.destroy(course.thumbnail.public_id, {
          resource_type: "image",
        });
      }

      course.thumbnail = {
        url: newThumbnail.secure_url,
        public_id: newThumbnail.public_id,
      };
    }

    if (req.files?.videos?.length) {
      for (const video of req.files.videos) {
        const uploaded = await uploadVideoToCloudinary(
          video.path,
          "skillify-videos"
        );

        newVideos.push({
          title: video.originalname.replace(/\.[^/.]+$/, ""),
          url: uploaded.secure_url,
          public_id: uploaded.public_id,
        });
      }

      course.videos.push(...newVideos);
    }

    if (title) course.title = title;
    if (description) course.description = description;
    if (price !== undefined) course.price = price;
    if (upiId) await User.findByIdAndUpdate(req.user.userId, { upiId });

    await course.save();
    await course.populate("instructor", "name");

    await invalidateCourseCache(null, course.instructor.toString());

    return sendSuccessResponse(res, { course }, 200);
  } catch (error) {
    if (newThumbnail?.public_id)
      await cloudinary.uploader.destroy(newThumbnail.public_id);

    for (const vid of newVideos) {
      await cloudinary.uploader.destroy(vid.public_id);
    }

    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// DELETE COURSE
export const deleteCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    await Course.findByIdAndDelete(course._id);

    if (course.thumbnail?.public_id) {
      await cloudinary.uploader.destroy(course.thumbnail.public_id, {
        resource_type: "image",
      });
    }

    for (const vid of course.videos) {
      await cloudinary.uploader.destroy(vid.public_id, {
        resource_type: "video",
      });
    }

    await invalidateCourseCache(null, course.instructor.toString());

    return sendSuccessResponse(res, { message: "Course deleted" }, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// DELETE SINGLE VIDEO
export const deleteVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const video = course.videos.id(videoId);
    if (!video) return sendErrorResponse(res, "Video not found", 404);

    course.videos.pull(videoId);
    await course.save();

    await cloudinary.uploader.destroy(video.public_id, {
      resource_type: "video",
    });

    await invalidateCourseCache(null, course.instructor.toString());

    return sendSuccessResponse(res, { message: "Video deleted" }, 200);
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};

// REPLACE VIDEO
export const replaceVideo = async (req, res) => {
  try {
    const { courseId, videoId } = req.params;

    if (!req.files?.videos?.length) {
      return sendErrorResponse(res, "New video file is required", 400);
    }

    const course = await Course.findById(courseId);
    if (!course) return sendErrorResponse(res, "Course not found", 404);

    if (course.instructor.toString() !== req.user.userId)
      return sendErrorResponse(res, "Not authorized", 403);

    const index = course.videos.findIndex((v) => v._id.toString() === videoId);

    if (index === -1) return sendErrorResponse(res, "Video not found", 404);

    const oldVideo = course.videos[index];

    const uploaded = await uploadVideoToCloudinary(
      req.files.videos[0].path,
      "skillify-videos"
    );

    course.videos[index].title = req.files.videos[0].originalname.replace(
      /\.[^/.]+$/,
      ""
    );
    course.videos[index].url = uploaded.secure_url;
    course.videos[index].public_id = uploaded.public_id;

    await course.save();

    await cloudinary.uploader.destroy(oldVideo.public_id, {
      resource_type: "video",
    });

    await invalidateCourseCache(null, course.instructor.toString());

    return sendSuccessResponse(
      res,
      { message: "Video replaced successfully", video: course.videos[index] },
      200
    );
  } catch (error) {
    return sendErrorResponse(res, error.message || "Server Error", 500);
  }
};
