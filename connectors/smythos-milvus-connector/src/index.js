import express from "express";
import dotenv from "dotenv";
import healthRoutes from "./routes/health.js";
import vectorRoutes from "./routes/vectors.js";

dotenv.config();
const app = express();
app.use(express.json());

app.use("/health", healthRoutes);
app.use("/vectors", vectorRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SmythOS Milvus Connector running at http://localhost:${PORT}`);
});
