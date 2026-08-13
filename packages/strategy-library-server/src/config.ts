/**
 * The Anthropic API key lives only here, server-side, read from the
 * environment. It is never sent to, or accepted from, the client — the
 * whole point of this package existing is that the client never holds
 * or transmits it.
 */
export interface ServerConfig {
  port: number;
  anthropicApiKey: string;
  anthropicModel: string;
  allowedOrigin: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const anthropicApiKey = env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. The personalisation backend cannot start without it — " +
        "set it in the environment, never hardcode it, never accept it from a client request."
    );
  }

  return {
    port: env.PORT ? Number(env.PORT) : 8787,
    anthropicApiKey,
    anthropicModel: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    allowedOrigin: env.ALLOWED_ORIGIN ?? "http://localhost:5173",
  };
}
