import express from "express";
import jobsRoutes from "./routes/jobs.routes.js";

const app = express();

app.use(express.json());
app.use(jobsRoutes);

export default app;
