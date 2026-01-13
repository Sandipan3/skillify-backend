import User from "../models/User.js";
import jwt from "jsonwebtoken";
import { sendErrorResponse, sendSuccessResponse } from "../utils/response.js";
import { sendMail } from "../services/sendMail.js";
import { generateAccessToken, generateRefreshToken } from "../utils/token.js";
// invite email for admin onboarding
export const adminInvite = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendErrorResponse(res, "Email is required", 400);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser?.roles?.includes("admin")) {
      return sendErrorResponse(res, "User is already an admin", 400);
    }

    const inviteToken = jwt.sign(
      { email, role: "admin", issuedBy: req.user.userId },
      process.env.ADMIN_SECRET,
      { expiresIn: "15m" }
    );

    const inviteLink = `${process.env.FRONTEND_URL}/admin/accept?token=${inviteToken}`;

    await sendMail({
      to: email,
      subject: "Admin Invitation, Skillify",
      html: `<div style="font-family: Arial, sans-serif">
          <h2>You have been invited as an Admin</h2>
          <p>Click the button below to accept the invitation:</p>
          <a
            href="${inviteLink}"
            style="
              display:inline-block;
              padding:12px 20px;
              background:#2563eb;
              color:#fff;
              text-decoration:none;
              border-radius:6px;
              font-weight:bold;
            "
          >
            Accept Admin Invite
          </a>
          <p style="margin-top:16px">
            This invite expires in <b>15 minutes</b>.
          </p>
        </div>`,
    });

    return sendSuccessResponse(res, {
      message: "Admin invitation sent successfully",
    });
  } catch (error) {
    sendErrorResponse(res, "Failed to send admin invite", 400);
  }
};

// accept admin invitation
export const acceptAdminInvite = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return sendErrorResponse(res, "Token is required", 400);
    }

    // verify
    let payload;
    try {
      payload = jwt.verify(token, process.env.ADMIN_SECRET);
    } catch {
      return sendErrorResponse(res, "Invalid or expired invite token", 401);
    }

    if (payload.email !== req.user.email) {
      return sendErrorResponse(res, "Invite email mismatch", 403);
    }

    // find user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }
    if (user.roles.includes("admin")) {
      return sendErrorResponse(res, "User is already an admin", 400);
    }

    //upgrade role
    user.roles = ["admin"];
    await user.save();

    // issue new tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return sendSuccessResponse(res, {
      message: "Admin role granted successfully",
      accessToken,
    });
  } catch (error) {
    sendErrorResponse(res, "Invalid or expired invite token", 400);
  }
};

// get roles count
export const getRolesCount = async (req, res) => {
  try {
    const adminCount = await User.countDocuments({ roles: "admin" });
    const instructorCount = await User.countDocuments({ roles: "instructor" });
    const studentCount = await User.countDocuments({ roles: "student" });

    return sendSuccessResponse(
      res,
      { adminCount, instructorCount, studentCount },
      200
    );
  } catch (error) {
    sendErrorResponse(res, "Unable to get roles count", 400);
  }
};
