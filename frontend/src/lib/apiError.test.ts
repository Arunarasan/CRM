import { describe, expect, it } from "vitest";
import { apiError } from "./apiError";

describe("apiError", () => {
  it("prefers the server message", () => {
    expect(apiError({ response: { data: { message: "Invoice already paid" } } })).toBe("Invoice already paid");
  });

  it("falls back to the error field, then the exception message, then the default", () => {
    expect(apiError({ response: { data: { error: "Conflict" } } })).toBe("Conflict");
    expect(apiError(new Error("Network Error"))).toBe("Network Error");
    expect(apiError({}, "Custom fallback")).toBe("Custom fallback");
    expect(apiError(undefined)).toBe("Something went wrong. Please try again.");
  });
});
