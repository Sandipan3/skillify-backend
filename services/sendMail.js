import axios from "axios";

//generic send mail
export const sendMail = async ({ to, subject, html }) => {
  try {
    const res = await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: {
          name: "Skillify",
          email: "projectskillify@gmail.com",
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      },
      {
        headers: {
          "api-key": process.env.BREVO_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    console.log("MAIL SENT:", res.data);
  } catch (error) {
    console.error("MAIL ERROR:", error.response?.data || error.message);
    throw error;
  }
};

// EMAIL VERIFICATION (OTP)
export const verifyRegisterEmail = async (userEmail, otp) => {
  const html = `
    <div style="font-family: Arial, sans-serif">
      <h3>Email Verification</h3>
      <p>Your OTP is:</p>
      <h2>${otp}</h2>
      <p>This OTP is valid for 15 minutes.</p>
    </div>
  `;

  await sendMail({
    to: userEmail,
    subject: "Verify your email",
    html,
  });
};

// PASSWORD RESET EMAIL
export const sendPasswordResetEmail = async (userEmail, resetLink) => {
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h2>Password Reset Request</h2>

      <p>You requested to reset your password.</p>

      <a 
        href="${resetLink}"
        style="
          display: inline-block;
          padding: 12px 20px;
          background-color: #f59e0b;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: bold;
        "
      >
        Reset Password
      </a>

      <p style="margin-top: 20px;">
        This link is valid for <b>15 minutes</b>.
      </p>

      <p>If you did not request this, ignore this email.</p>
    </div>
  `;

  await sendMail({
    to: userEmail,
    subject: "Reset your Skillify password",
    html,
  });
};

// TICKET CREATION MAIL
export const sendTicketCreationMail = async (userEmail, ticketId) => {
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h1>Your ticket has been created. </h1> <br />
      <h3>Ticket ID : ${ticketId}</h3>
    </div>`;

  await sendMail({
    to: userEmail,
    subject: "Role change Ticket",
    html,
  });
};

// ROLE UPGRADE SUCCESS MAIL
export const sendTicketUpgradeApprovedMail = async (userEmail) => {
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h1>Congratulations! Your role change request change was successful. </h1> <br />
      <h3>Kindly login again for changes.</h3>
    </div>`;

  await sendMail({
    to: userEmail,
    subject: "Role change Approved",
    html,
  });
};

// ROLE UPGRADE DENIAL MAIL
export const sendTicketUpgradeRejectedMail = async (userEmail) => {
  const html = `<div style="font-family: Arial, sans-serif; line-height: 1.5">
      <h1>Congratulations! Your role change request change was unsuccessful. </h1> <br />
      <h3>Your request was denied by admin</h3>
    </div>`;

  await sendMail({
    to: userEmail,
    subject: "Role change Rejected",
    html,
  });
};
