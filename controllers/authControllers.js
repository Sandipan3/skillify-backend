import bcrypt from "bcrypt";
import User from "../models/User.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/response.js";
import redis from "../config/redis.js";

dotenv.config();

// cache invalidation helper
const invalidateUserProfileCache = async (userId) => {
  try {
    await redis.del(`user:profile:${userId}`);
  } catch (err) {
    console.warn("USER PROFILE CACHE INVALIDATION ERROR:", err.message);
  }
};

// register
export const register = async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return sendErrorResponse(res, "Fields cannot be empty", 400);
  }

  try {
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
        password
      )
    ) {
      return sendErrorResponse(
        res,
        "Password must meet complexity requirements.",
        400
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendErrorResponse(res, "Email already exists.", 400);
    }

    const salt = parseInt(process.env.BCRYPT_SALT) || 10;
    const hashedPassword = await bcrypt.hash(password, salt);

    await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user",
      profileCompleted: false,
    });

    return sendSuccessResponse(
      res,
      { message: "User registered successfully" },
      201
    );
  } catch (error) {
    return sendErrorResponse(res, "User registration failed", 500);
  }
};

// login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return sendErrorResponse(res, "Fields cannot be empty", 400);

  try {
    const user = await User.findOne({ email });
    if (!user) return sendErrorResponse(res, "User does not exist", 404);

    const match = await bcrypt.compare(password, user.password);
    if (!match) return sendErrorResponse(res, "Incorrect password", 401);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // delete password and return user
    const userObj = user.toObject();
    delete userObj.password;

    return sendSuccessResponse(res, {
      message: "Login successful",
      user: userObj,
      accessToken,
    });
  } catch (error) {
    return sendErrorResponse(res, "Login failed", 500);
  }
};

// refresh token
export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return sendErrorResponse(res, "No refresh token provided", 401);

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) return sendErrorResponse(res, "User not found", 404);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccessResponse(res, {
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
    });
  } catch (error) {
    return sendErrorResponse(res, "Invalid or expired refresh token", 401);
  }
};

// logout
export const logout = (req, res) => {
  try {
    res.clearCookie("refreshToken");
    return sendSuccessResponse(res, { message: "Logout successful" });
  } catch (error) {
    return sendErrorResponse(res, "Logout failed", 500);
  }
};

// profile (Redis Cached)
export const profile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const key = `user:profile:${userId}`;

    // read-through cache
    const cached = await redis.get(key);
    if (cached) {
      return sendSuccessResponse(res, { user: JSON.parse(cached) });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) return sendErrorResponse(res, "User not found", 404);

    await redis.set(key, JSON.stringify(user), "EX", 300);

    return sendSuccessResponse(res, { user });
  } catch (error) {
    return sendErrorResponse(res, "Server error", 500);
  }
};

// select role
export const selectRole = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { newRole } = req.body;

    if (!["student", "instructor"].includes(newRole))
      return sendErrorResponse(res, "Invalid role selected", 400);

    const user = await User.findById(userId).select("-password");
    if (!user) return sendErrorResponse(res, "User not found", 404);

    user.role = newRole;
    user.profileCompleted = true;
    await user.save();

    // invalidate cache & refresh role cache
    await invalidateUserProfileCache(userId);

    return sendSuccessResponse(res, {
      message: "Role updated",
      user,
    });
  } catch (error) {
    return sendErrorResponse(res, "Server error", 500);
  }
};

// admin change role
export const changeRole = async (req, res) => {
  try {
    const { userId, newRole } = req.body;

    if (!["student", "instructor"].includes(newRole))
      return sendErrorResponse(res, "Invalid role", 400);

    const user = await User.findById(userId).select("-password");
    if (!user) return sendErrorResponse(res, "User not found", 404);

    user.role = newRole;
    await user.save();

    await invalidateUserProfileCache(userId);

    return sendSuccessResponse(res, {
      message: "Role updated",
      user,
    });
  } catch (error) {
    return sendErrorResponse(res, "Server error", 500);
  }
};

// google callback
export const googleCallback = async (req, res) => {
  try {
    const user = req.user;

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(
      `http://localhost:5173/auth/callback?access_token=${accessToken}`
    );
  } catch (error) {
    return sendErrorResponse(res, "Google auth failed", 500);
  }
};
