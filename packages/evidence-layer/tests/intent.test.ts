import { describe, expect, it } from "vitest";
import { classifyIntent } from "../src/intent";

describe("classifyIntent", () => {
  it("matches a single clear category", () => {
    expect(classifyIntent("what is the proactive strategy for mealtimes")).toContain("proactive_strategy");
  });

  it("matches multiple categories when the query spans them", () => {
    const categories = classifyIntent("what's the transport safety plan if there's an incident on the bus");
    expect(categories).toContain("transport_safety");
    expect(categories).toContain("incident_response");
  });

  it("returns an empty list for an unrelated query", () => {
    expect(classifyIntent("what's the weather like today")).toEqual([]);
  });

  it("matches restrictive practice phrasing", () => {
    expect(classifyIntent("does this restraint need authorisation")).toContain("restrictive_practice");
  });

  it("matches consent phrasing", () => {
    expect(classifyIntent("has the guardian given consent for this")).toContain("consent");
  });
});
