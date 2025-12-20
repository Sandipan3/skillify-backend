// import axios from "axios";

export const verifyRegisterEmail = async (userEmail, otp) => {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Task Management",
          email: "no-reply@skillify.dev",
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
