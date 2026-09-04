import express, { type Express } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import { createDraftRouter } from "./routes/draft";

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
  app.use(express.json({ limit: "512kb" }));

  const anthropicClient = options.anthropicClient ?? new Anthropic({ apiKey: options.anthropicApiKey });

  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

  app.use(createDraftRouter({ anthropicClient, model: options.anthropicModel }));

  return app;
}
