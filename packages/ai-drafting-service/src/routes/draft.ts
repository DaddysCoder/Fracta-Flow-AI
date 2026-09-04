import type { Request, Response, Router } from "express";
import { Router as createRouter } from "express";
import type Anthropic from "@anthropic-ai/sdk";
import { extractAllowedEvidence } from "../evidenceAllowlist";
import { buildDraftingPrompt } from "../promptBuilder";
import { runDraftGeneration } from "../anthropicClient";
import { checkGroundedness } from "../guard";
import { logGenerationError, logRefusal, logGroundednessWarning } from "../logger";

export interface DraftRouteDeps {
  anthropicClient: Anthropic;
  model: string;
}

/**
 * POST /api/draft
 *
 * Input contract: `evidenceHits` is expected to be the array a host app
 * got back from `@fracta-flow/evidence-layer`'s `rankEvidence(...)` —
 * evidence already selected, tier-gated, and workflow-scored. This route
 * never calls `rankEvidence` itself and never accepts a raw candidate
 * pool or a participant identity — `extractAllowedEvidence` re-validates
 * governance (approved + current + clean PII/secret/prompt-injection
 * inspection) and only reads a fixed allowlist of fields onto
 * `AllowedEvidenceItem` (see evidenceAllowlist.ts for why that makes
 * identity leakage structurally impossible, not just policy-forbidden).
 *
 * Response is always 200 once the request itself is valid; `outcome`
 * carries the same 4-way class strategy-library-server's
 * `/api/personalize` uses (success / refusal / network_error /
 * api_error), collapsed to what the client needs while the finer-grained
 * network_error vs. api_error split is used for server-side logging only.
 */
export function createDraftRouter(deps: DraftRouteDeps): Router {
  const router = createRouter();

  router.post("/api/draft", async (req: Request, res: Response) => {
    const { instruction, evidenceHits: rawEvidenceHits } = req.body ?? {};

    if (typeof instruction !== "string" || !instruction.trim()) {
      return res.status(400).json({ error: "instruction is required." });
    }

    const evidence = extractAllowedEvidence(rawEvidenceHits);
    if (evidence.length === 0) {
      return res.status(400).json({
        error:
          "No usable evidence was provided. evidenceHits must be the output of rankEvidence(), containing only approved, current records.",
      });
    }

    const prompt = buildDraftingPrompt(instruction, evidence);
    const evidenceIds = evidence.map((item) => item.id);

    const generation = await runDraftGeneration(deps.anthropicClient, deps.model, prompt);

    switch (generation.outcome) {
      case "success": {
        const groundedness = checkGroundedness(generation.result.draft, generation.result.evidenceUsedIds, evidence);
        if (!groundedness.clean) {
          logGroundednessWarning({
            evidenceIds,
            invalidEvidenceIds: groundedness.invalidEvidenceIds,
            suspiciousTermCount: groundedness.suspiciousTerms.length,
          });
        }

        return res.status(200).json({
          outcome: "success",
          draft: generation.result.draft,
          evidenceUsedIds: generation.result.evidenceUsedIds,
          groundedness,
        });
      }
      case "refusal": {
        logRefusal({ evidenceIds, httpStatus: null });
        return res.status(200).json({ outcome: "refusal" });
      }
      case "network_error":
      case "api_error": {
        logGenerationError({
          evidenceIds,
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
