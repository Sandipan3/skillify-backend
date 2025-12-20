import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const resend = new Resend(process.env.RESEND_KEY);

export const verifyRegisterEmail = async (userEmail, otp) => {
  try {
    await resend.emails.send({
      from: "Skillify <no-reply@resend.dev>",
      to: userEmail,
      subject: "Verify your email",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px">
          <h2>Email Verification</h2>
          <p>Your One-Time Password (OTP) is:</p>

          <div style="
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 4px;
            margin: 16px 0;
          ">
            ${otp}
          </div>

          <p>This OTP is valid for <strong>15 minutes</strong>.</p>
          <p>If you did not request this, please ignore this email.</p>

          <hr />
          <small>This is an automated email. Do not reply.</small>
        </div>
      `,
    });
  } catch (error) {
    console.error("Resend email error:", error);
    throw new Error("Failed to send verification email");
  }
};
