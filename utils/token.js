import dotenv from "dotenv";
dotenv.config();
import jwt from "jsonwebtoken";

export const generateAccessToken = (user) => {
  return jwt.sign(
    { userId: user._id, roles: user.roles },
    process.env.JWT_KEY,
    {
      expiresIn: "15m",
    }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { userId: user._id, roles: user.roles },
    process.env.JWT_KEY,
    {
      expiresIn: "7d",
    }
  );
};
