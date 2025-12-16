import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBaseUrl,
  formatNumber,
  formatDate,
  cleanEventName,
  formatChangeDescription,
  toTitleCase,
  formatTime,
  fallbackF3Logo,
} from "./utils";

describe("getBaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(getBaseUrl()).toBe("https://example.com");
  });

  it("returns localhost in development server environment", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "development";
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("throws error in production without NEXT_PUBLIC_SITE_URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NODE_ENV = "production";
    expect(() => getBaseUrl()).toThrow(
      "NEXT_PUBLIC_SITE_URL must be defined in production",
    );
  });
});

describe("formatNumber", () => {
  it("formats integer with no decimals", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("formats number with specified decimals", () => {
    expect(formatNumber(1234.5678, 2)).toBe("1,234.57");
  });

  it("formats number with custom thousand separator", () => {
    expect(formatNumber(1234567, 0, ".")).toBe("1.234.567");
  });

  it("returns N/A for null", () => {
    expect(formatNumber(null)).toBe("N/A");
  });

  it("returns N/A for NaN", () => {
    expect(formatNumber(NaN)).toBe("N/A");
  });

  it("formats zero correctly", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-1234.56, 2)).toBe("-1,234.56");
  });

  it("formats small numbers without separator", () => {
    expect(formatNumber(123)).toBe("123");
  });

  it("formats large numbers with multiple separators", () => {
    expect(formatNumber(1234567890)).toBe("1,234,567,890");
  });
});

describe("formatDate", () => {
  it("formats date string to default format", () => {
    const result = formatDate("2024-01-15");
    expect(result).toMatch(/Mon, Jan 15 2024/);
  });

  it("formats Date object", () => {
    const date = new Date(Date.UTC(2024, 0, 15));
    const result = formatDate(date);
    expect(result).toMatch(/Mon, Jan 15 2024/);
  });

  it("formats with M D Y format", () => {
    const result = formatDate("2024-06-20", "M D Y");
    expect(result).toBe("Jun 20 2024");
  });

  it("formats with M Y format", () => {
    const result = formatDate("2024-06-20", "M Y");
    expect(result).toBe("Jun 2024");
  });

  it("handles different months correctly", () => {
    expect(formatDate("2024-12-25", "M D Y")).toBe("Dec 25 2024");
    expect(formatDate("2024-03-01", "M D Y")).toBe("Mar 1 2024");
  });
});

describe("cleanEventName", () => {
  it("removes Backblast! prefix", () => {
    expect(cleanEventName("Backblast! Morning workout")).toBe(
      "Morning workout",
    );
  });

  it("removes Backblast! prefix case insensitively", () => {
    expect(cleanEventName("BACKBLAST! Morning workout")).toBe(
      "Morning workout",
    );
    expect(cleanEventName("backblast! Morning workout")).toBe(
      "Morning workout",
    );
  });

  it("trims whitespace", () => {
    expect(cleanEventName("Backblast!   Extra spaces")).toBe("Extra spaces");
  });

  it("returns original if no prefix", () => {
    expect(cleanEventName("Regular event name")).toBe("Regular event name");
  });

  it("handles empty string", () => {
    expect(cleanEventName("")).toBe("");
  });
});

describe("formatChangeDescription", () => {
  it("formats positive change", () => {
    expect(formatChangeDescription(25.5, "Event")).toBe(
      "Event volume is up 25.50% from last month.",
    );
  });

  it("formats negative change", () => {
    expect(formatChangeDescription(-15.25, "Q")).toBe(
      "Q volume is down 15.25% from last month.",
    );
  });

  it("formats zero change", () => {
    expect(formatChangeDescription(0, "Event")).toBe(
      "There is no change in Event volume from last month.",
    );
  });

  it("returns empty string for null", () => {
    expect(formatChangeDescription(null, "Event")).toBe("");
  });

  it("handles small decimal changes", () => {
    expect(formatChangeDescription(0.01, "Event")).toBe(
      "Event volume is up 0.01% from last month.",
    );
  });
});

describe("toTitleCase", () => {
  it("converts lowercase to title case", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
  });

  it("converts uppercase to title case", () => {
    expect(toTitleCase("HELLO WORLD")).toBe("Hello World");
  });

  it("handles mixed case", () => {
    expect(toTitleCase("hElLo WoRlD")).toBe("Hello World");
  });

  it("handles single word", () => {
    expect(toTitleCase("monday")).toBe("Monday");
  });

  it("handles empty string", () => {
    expect(toTitleCase("")).toBe("");
  });

  it("handles multiple spaces", () => {
    expect(toTitleCase("hello  world")).toBe("Hello  World");
  });
});

describe("formatTime", () => {
  it("formats morning time", () => {
    expect(formatTime("0530")).toBe("5:30am");
  });

  it("formats afternoon time", () => {
    expect(formatTime("1430")).toBe("2:30pm");
  });

  it("formats midnight", () => {
    expect(formatTime("0000")).toBe("12:00am");
  });

  it("formats noon", () => {
    expect(formatTime("1200")).toBe("12:00pm");
  });

  it("formats 11pm", () => {
    expect(formatTime("2300")).toBe("11:00pm");
  });

  it("returns original for invalid length", () => {
    expect(formatTime("530")).toBe("530");
    expect(formatTime("05300")).toBe("05300");
  });

  it("returns original for empty string", () => {
    expect(formatTime("")).toBe("");
  });

  it("handles edge case at 1pm", () => {
    expect(formatTime("1300")).toBe("1:00pm");
  });
});

describe("fallbackF3Logo", () => {
  it("generates SVG data URI with default color", () => {
    const result = fallbackF3Logo();
    expect(result).toContain("data:image/svg+xml;base64,");
    // Decode and check for default white color
    const decoded = atob(result.replace("data:image/svg+xml;base64,", ""));
    expect(decoded).toContain('stroke="#fff"');
    expect(decoded).toContain('fill="#fff"');
  });

  it("generates SVG data URI with custom color", () => {
    const result = fallbackF3Logo("#ff0000");
    const decoded = atob(result.replace("data:image/svg+xml;base64,", ""));
    expect(decoded).toContain('stroke="#ff0000"');
    expect(decoded).toContain('fill="#ff0000"');
  });

  it("handles hex color without hash", () => {
    const result = fallbackF3Logo("blue");
    const decoded = atob(result.replace("data:image/svg+xml;base64,", ""));
    expect(decoded).toContain('stroke="blue"');
  });
});
