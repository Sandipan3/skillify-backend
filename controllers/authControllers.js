import bcrypt from "bcrypt";
import User from "../models/User.js";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
dotenv.config();

// register
export const register = async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(403).json({
      status: "error",
      message: "fields cannot be empty",
    });
  }

  try {
    if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(
        password
      )
    ) {
      return res.status(403).json({
        status: "error",
        message:
          "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(403).json({
        status: "error",
        message: "A user with this email already exists.",
      });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT, 10) || 10;
    const hashPassword = await bcrypt.hash(password, saltRounds);

    const user = new User({ name, email, password: hashPassword, role });
    await user.save();

    return res.status(201).json({
      status: "success",
      data: { message: "user registered successfully" },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      status: "error",
      message: "User registration was unsuccessful",
    });
  }
};

// login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(403).json({
      status: "error",
      message: "fields cannot be empty",
    });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User with the email does not exist",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({
        status: "error",
        message: "Incorrect password",
      });
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: "success",
      data: { message: "Login successful", accessToken },
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Login was unsuccessful",
    });
  }
};

// refresh
export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({
      status: "error",
      message: "No refresh Token in cookies",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found",
      });
    }

    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: "success",
      data: { message: "Login successful", accessToken: newAccessToken },
    });
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired refresh token",
    });
  }
};

// logout
export const logout = (req, res) => {
  try {
    res.clearCookie("refreshToken");
    res.status(200).json({
      status: "success",
      message: "Logout was successful",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Logout was unsuccessful",
    });
  }
};

// profile
export const profile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "User not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Server error",
    });
  }
};
