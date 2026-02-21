import express from "express";
import morgan from "morgan";
import cors from "cors";
import courseRoutes from "./routes/courseRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import enrollmentRoutes from "./routes/enrollmentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import ticketRoutes from "./routes/ticketRoutes.js";
import cookieParser from "cookie-parser";
import connectDB from "./config/connectDb.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import { sendSuccessResponse } from "./utils/response.js";

// app setup
const app = express();

//=========GLOBAL MIDDLEWARES===========
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: [process.env.FRONTEND_URL, "http://localhost:5173"],
    credentials: true,
  }),
);
//====localhost=====================
// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//   })
// );
//=======================================

// MongoDB Connection
connectDB();

//routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/course", courseRoutes);
app.use("/api/v1/enrollment", enrollmentRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/ticket", ticketRoutes);

//this is for the github workflow ping server every 10 mins
app.get("/api/v1/ping", (req, res) => {
  sendSuccessResponse(
    res,
    {
      status: "Hello I am fine!",
      timestamp: Date.now(),
    },
    200,
  );
});

app.use(errorMiddleware);

export default app;
