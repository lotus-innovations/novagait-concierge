import { afterEach, describe, expect, it } from "vitest";
import { allowedOrigins, corsHeadersFor } from "@/lib/cors";

afterEach(() => {
  delete process.env.WIDGET_ALLOWED_ORIGINS;
});

describe("widget CORS policy", () => {
  it("defaults to the clinic demo host only", () => {
    expect(allowedOrigins()).toEqual(["https://demo.lotusinnovations.io"]);
  });

  it("grants headers to an allowlisted origin", () => {
    const headers = corsHeadersFor("https://demo.lotusinnovations.io");
    expect(headers["Access-Control-Allow-Origin"]).toBe(
      "https://demo.lotusinnovations.io",
    );
    expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
    expect(headers.Vary).toBe("Origin");
  });

  it("gives nothing to unknown origins or same-origin requests", () => {
    expect(corsHeadersFor("https://evil.example")).toEqual({});
    expect(corsHeadersFor(null)).toEqual({});
  });

  it("honors the WIDGET_ALLOWED_ORIGINS override", () => {
    process.env.WIDGET_ALLOWED_ORIGINS =
      "http://localhost:3001, https://demo.lotusinnovations.io";
    expect(allowedOrigins()).toEqual([
      "http://localhost:3001",
      "https://demo.lotusinnovations.io",
    ]);
    expect(
      corsHeadersFor("http://localhost:3001")["Access-Control-Allow-Origin"],
    ).toBe("http://localhost:3001");
  });
});
