import { loadConfig } from "./config";
import { createApp } from "./app";

const config = loadConfig();
const app = createApp({
  anthropicApiKey: config.anthropicApiKey,
  anthropicModel: config.anthropicModel,
  allowedOrigin: config.allowedOrigin,
});

app.listen(config.port, () => {
  console.log(`strategy-library-server listening on :${config.port}`);
});
