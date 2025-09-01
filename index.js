import http from "http";
import dotenv from "dotenv";
import app from "./app.js";
dotenv.config();

const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

server.listen(PORT, console.log(`SERVER IS RUNNING ON PORT ${PORT}`));
