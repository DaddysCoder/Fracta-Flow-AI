import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EvidenceSearch } from "./EvidenceSearch";

describe("EvidenceSearch", () => {
  it("shows an org-wide-only notice with no participant selected", () => {
    render(<EvidenceSearch activeParticipant={null} />);
    expect(screen.getByText(/limited to org-wide evidence/i)).toBeInTheDocument();
  });

  it("runs a query and renders ranked results with tier, category and workflow multiplier visible", async () => {
    const user = userEvent.setup();
    render(<EvidenceSearch activeParticipant={null} />);

    await user.type(screen.getByLabelText(/query/i), "transport seatbelt");
    await user.selectOptions(screen.getByLabelText(/workflow context/i), "transport");
    await user.click(screen.getByRole("button", { name: /search evidence/i }));

    // The top hit should be the org procedure covering transport safety.
    expect(await screen.findByText(/transport safety check/i)).toBeInTheDocument();
    expect(screen.getAllByText(/org procedure \(current\)/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/transport safety/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/workflow ×/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/final score/i).length).toBeGreaterThan(0);
  });

  it("shows nothing before a query is submitted", () => {
    render(<EvidenceSearch activeParticipant={null} />);
    expect(screen.queryByText(/no approved evidence matched/i)).not.toBeInTheDocument();
  });

  it("reports no matches for a query nothing satisfies", async () => {
    const user = userEvent.setup();
    render(<EvidenceSearch activeParticipant={null} />);

    await user.type(screen.getByLabelText(/query/i), "zzz nonexistent evidence zzz");
    await user.click(screen.getByRole("button", { name: /search evidence/i }));

    expect(await screen.findByText(/no approved evidence matched/i)).toBeInTheDocument();
  });
});
