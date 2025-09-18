import express from "express";
import { insertVector, searchVector } from "../connector.js";

const router = express.Router();

router.post("/insert", async (req, res) => {
  const { vector, id } = req.body;
  const result = await insertVector(vector, id);
  res.json(result);
});

router.post("/search", async (req, res) => {
  const { queryVector, topK } = req.body;
  const result = await searchVector(queryVector, topK);
  res.json(result);
});

export default router;
