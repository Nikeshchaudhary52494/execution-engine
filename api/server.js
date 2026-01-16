import app from "./app.js";
import { API_PORT } from "./config/env.js";

app.listen(API_PORT, () => {
  console.log(`🚀 API server running on port ${API_PORT}`);
});
