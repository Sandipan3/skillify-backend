import crypto from "crypto";
import Payment from "../models/Payment.js";
import Enrollment from "../models/Enrollment.js";
import razorpay from "../config/razorpay.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import redis from "../config/redis.js";
import Course from "../models/Course.js";

// Helper to invalidate enrollment related cache
const invalidateEnrollmentCache = async (studentId, courseId) => {
  if (studentId) await redis.del(`enrollments:student:${studentId}`);
  if (courseId) await redis.del(`enrollment:count:${courseId}`);
};

// enroll in paid course
export const enrollInPaidCourse = async (req, res) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.userId;

    const course = await Course.findById(courseId);
    if (!course) {
      return sendErrorResponse(res, "Course not found", 404);
    }

    if (course.price === 0) {
      return sendErrorResponse(res, "Free course. No payment required!", 400);
    }

    //create order
    const order = await razorpay.orders.create({
      currency: "INR",
      amount: course.price * 100, //amount in paise
      receipt: `${courseId}_${Date.now()}`,
    });
    //note: recipt max length is 40. For now it is 24 + 1 + 13 = 38 characters

    //write to db
    await Payment.create({
      user: studentId,
      course: courseId,
      amount: course.price,
      razorpayOrderId: order.id,
      status: "created",
    });

    return sendSuccessResponse(res, { order }, 200);
  } catch (error) {
    return sendErrorResponse(
      res,
      error.message || "Failed to create payment order",
      500
    );
  }
};

export const verifyPaymentAndEnroll = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
    } = req.body;

    const studentId = req.user.userId;

    // Fetch payment record first
    const payment = await Payment.findOne({
      razorpayOrderId: razorpay_order_id,
      user: studentId,
      course: courseId,
    });

    // Payment record missing, mark as failed
    if (!payment) {
      await Payment.findOneAndUpdate(
        {
          razorpayOrderId: razorpay_order_id,
          user: studentId,
          status: "created",
        },
        { status: "failed" }
      );

      return sendErrorResponse(res, "Payment record not found", 400);
    }

    // Idempotent check
    if (payment.status === "paid") {
      return sendSuccessResponse(
        res,
        { message: "Payment already verified" },
        200
      );
    }

    // Verify Razorpay signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      payment.status = "failed";
      await payment.save();

      return sendErrorResponse(res, "Invalid payment signature", 400);
    }

    // Mark payment as paid
    payment.status = "paid";
    await payment.save();

    // Prevent duplicate enrollment
    const alreadyEnrolled = await Enrollment.findOne({
      course: courseId,
      student: studentId,
    });

    if (alreadyEnrolled) {
      return sendSuccessResponse(res, { message: "Already enrolled" }, 200);
    }

    // Create enrollment
    const enrollment = await Enrollment.create({
      course: courseId,
      student: studentId,
    });

    await enrollment.populate("course", "title instructor price thumbnail");
    await enrollment.populate("student", "name email");

    // Invalidate cache
    await invalidateEnrollmentCache(studentId, courseId);

    return sendSuccessResponse(res, { enrollment }, 201);
  } catch (error) {
    // Mark payment as failed on unexpected error
    if (req.body?.razorpay_order_id && req.user?.userId) {
      await Payment.findOneAndUpdate(
        {
          razorpayOrderId: req.body.razorpay_order_id,
          user: req.user.userId,
          status: "created",
        },
        { status: "failed" }
      );
    }

    return sendErrorResponse(
      res,
      error.message || "Payment verification failed",
      500
    );
  }
};
