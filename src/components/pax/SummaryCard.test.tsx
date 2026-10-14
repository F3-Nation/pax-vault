import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SummaryCard } from "./SummaryCard";

describe("SummaryCard with no event data", () => {
  it("renders the existing empty treatment for a null summary without AO links", () => {
    const markup = renderToStaticMarkup(<SummaryCard summary={null} />);

    expect(markup).toContain("PAX Summary");
    expect(markup.match(/No Event Data/g)).toHaveLength(11);
    expect(markup).not.toContain("/stats/ao/undefined");
  });
});
