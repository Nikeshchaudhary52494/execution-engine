import express from "express";
import {
  submitJob,
  getJobStatus,
} from "../controllers/jobs.controller.js";

const router = express.Router();

router.post("/v1/jobs", submitJob);
router.get("/v1/jobs/:id", getJobStatus);

export default router;
