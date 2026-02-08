import { describe, it, expect } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

describe("Dynamic PWA Manifest API", () => {
  it("returns manifest with root start_url when no referer", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
    );
    const response = await GET(request);
    const manifest = await response.json();

    expect(manifest.start_url).toBe("/");
    expect(manifest.name).toBe("F3 PAX Vault");
    expect(manifest.short_name).toBe("PAX Vault");
  });

  it("returns manifest with specific page start_url from referer", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
      {
        headers: {
          referer: "https://pax-vault.f3nation.com/region/37004?ao=123",
        },
      },
    );
    const response = await GET(request);
    const manifest = await response.json();

    expect(manifest.start_url).toBe("/region/37004?ao=123");
  });

  it("returns manifest with stats page start_url from referer", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
      {
        headers: {
          referer: "https://pax-vault.f3nation.com/stats/nation",
        },
      },
    );
    const response = await GET(request);
    const manifest = await response.json();

    expect(manifest.start_url).toBe("/stats/nation");
  });

  it("returns manifest with root start_url for invalid referer", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
      {
        headers: {
          referer: "not-a-valid-url",
        },
      },
    );
    const response = await GET(request);
    const manifest = await response.json();

    expect(manifest.start_url).toBe("/");
  });

  it("includes correct content type and cache headers", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
    );
    const response = await GET(request);

    expect(response.headers.get("Content-Type")).toBe(
      "application/manifest+json",
    );
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it("includes all required manifest fields", async () => {
    const request = new NextRequest(
      "https://pax-vault.f3nation.com/api/manifest",
    );
    const response = await GET(request);
    const manifest = await response.json();

    expect(manifest).toHaveProperty("name");
    expect(manifest).toHaveProperty("short_name");
    expect(manifest).toHaveProperty("description");
    expect(manifest).toHaveProperty("start_url");
    expect(manifest).toHaveProperty("display");
    expect(manifest).toHaveProperty("background_color");
    expect(manifest).toHaveProperty("theme_color");
    expect(manifest).toHaveProperty("icons");
    expect(manifest.icons).toHaveLength(3);
  });
});
