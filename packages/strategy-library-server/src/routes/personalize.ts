import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { SEED_TEMPLATES, SEED_SOURCES } from "@fracta-flow/strategy-library";
import { extractAllowedAxisData, isEntirelyEmpty } from "../axisData";
import { buildPersonalisationPrompt } from "../promptBuilder";
import { runPersonalisationGeneration } from "../anthropicClient";
import { logGenerationError, logRefusal } from "../logger";

export interface PersonalizeRouteDeps {
  anthropicClient: Anthropic;
  model: string;
}

/**
 * POST /api/personalize
 *
 * Two-step flow, step 3 only: strategy selection and capacity-adaptation
 * notes are practitioner acts that never touch this endpoint. This is
 * the one bounded generation call — it fires only for axes the strategy
 * template actually declares, pulling only the specific de-identified
 * profile field values the client sends for those axes (and re-validated
 * server-side against the template's declared axes regardless of what
 * the client sends — see extractAllowedAxisData).
 *
 * Response is always 200 once the request itself is valid; the `outcome`
 * field carries the three-way result the brief requires the client to be
 * able to distinguish (refusal / generic failure / success), collapsed
 * from the finer-grained network_error vs. api_error class used for
 * server-side logging only.
 */
export function createPersonalizeRouter(deps: PersonalizeRouteDeps): Router {
  const router = createRouter();

  router.post("/api/personalize", async (req: Request, res: Response) => {
    const { strategyTemplateId, axisData: rawAxisData } = req.body ?? {};

    if (typeof strategyTemplateId !== "string" || !strategyTemplateId) {
      return res.status(400).json({ error: "strategyTemplateId is required." });
    }

    const template = SEED_TEMPLATES.find((t) => t.id === strategyTemplateId);
    if (!template) {
      return res.status(404).json({ error: "Unknown strategyTemplateId." });
    }

    if (template.personalizationAxes.length === 0) {
      return res.status(400).json({
        error: "This strategy has no declared personalisation axes. Write the personalised activity manually.",
      });
    }

    const axisData = extractAllowedAxisData(rawAxisData, template.personalizationAxes);
    if (isEntirelyEmpty(axisData)) {
      return res.status(400).json({
        error: "No usable profile data was provided for this strategy's declared personalisation axes.",
      });
    }

    const prompt = buildPersonalisationPrompt(template, axisData);

    const generation = await runPersonalisationGeneration(deps.anthropicClient, deps.model, prompt);

    switch (generation.outcome) {
      case "success": {
        const citations = template.sourceIds
          .map((id) => SEED_SOURCES.find((s) => s.id === id))
          .filter((s): s is (typeof SEED_SOURCES)[number] => !!s)
          .map((s) => `${s.authors} (${s.publicationYear}). ${s.title}.`);

        return res.status(200).json({
          outcome: "success",
          personalisedActivity: generation.result.personalisedActivity,
          keptFixedStatement: generation.result.keptFixedStatement,
          mechanism: template.mechanism,
          safetyBoundary: template.safetyBoundary,
          citations,
        });
      }
      case "refusal": {
        logRefusal({
          strategyTemplateId,
          axesRequested: Object.keys(axisData),
          httpStatus: null,
        });
        return res.status(200).json({ outcome: "refusal" });
      }
      case "network_error":
      case "api_error": {
        logGenerationError({
          strategyTemplateId,
          outcome: generation.outcome,
          message: generation.message,
          status: generation.outcome === "api_error" ? generation.status : null,
        });
        return res.status(200).json({ outcome: generation.outcome, message: generation.message });
      }
    }
  });

  return router;
}
