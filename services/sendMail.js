import dotenv from "dotenv";
dotenv.config();
// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_KEY);

// export const verifyRegisterEmail = async (userEmail, otp) => {
//   try {
//     const res = await resend.emails.send({
//       from: "Resend <no-reply@resend.dev>",
//       to: userEmail,
//       subject: "Verify your email",
//       html: `<p>Your OTP is <b>${otp}</b></p>`,
//     });

//     console.log("RESEND RESPONSE:", res);
//   } catch (error) {
//     console.error("RESEND ERROR:", error);
//     throw error;
//   }
// };

import axios from "axios";

export const verifyRegisterEmail = async (userEmail, otp) => {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Skillify",
          email: "no-reply@skillify.dev",
          // can be any email in dev; verify domain later for prod
        },
        to: [
          {
            email: userEmail,
          },
        ],
        subject: "Verify your email",
        htmlContent: `
          <div style="font-family: Arial, sans-serif">
            <h3>Email Verification</h3>
            <p>Your OTP is:</p>
            <h2>${otp}</h2>
            <p>This OTP is valid for 15 minutes.</p>
          </div>
        `,
      },
      {
        headers: {
          "api-key": process.env.BREVO_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log("BREVO RESPONSE:", res.data);
  } catch (error) {
    console.error("BREVO ERROR:", error.response?.data || error.message);
    throw error;
  }
};
