import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_KEY);

export const verifyRegisterEmail = async (userEmail, otp) => {
  try {
    const res = await resend.emails.send({
      from: "Task Management <no-reply@resend.dev>",
      to: userEmail,
      subject: "Verify your email",
      html: `<p>Your OTP is <b>${otp}</b></p>`,
    });

    console.log("RESEND RESPONSE:", res);
  } catch (error) {
    console.error("RESEND ERROR:", error);
    throw error;
  }
};
