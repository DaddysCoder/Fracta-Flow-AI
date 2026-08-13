import express, { type Express } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { createPersonalizeRouter } from "./routes/personalize";

export interface CreateAppOptions {
  anthropicApiKey: string;
  anthropicModel: string;
  allowedOrigin: string;
  /** Injectable for tests — defaults to a real Anthropic client. */
  anthropicClient?: Anthropic;
}

export function createApp(options: CreateAppOptions): Express {
  const app = express();
  app.use(cors({ origin: options.allowedOrigin }));
  app.use(express.json({ limit: "256kb" }));

  const anthropicClient = options.anthropicClient ?? new Anthropic({ apiKey: options.anthropicApiKey });

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  app.use(createPersonalizeRouter({ anthropicClient, model: options.anthropicModel }));

  return app;
}
