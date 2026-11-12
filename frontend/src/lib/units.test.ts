import { describe, expect, it } from "vitest";
import { areaUnitFor, convertUnit, isAreaUnit, normalizeUnit, unitDef } from "./units";

describe("units", () => {
  it("normalises spellings to the canonical code", () => {
    expect(normalizeUnit("square feet")).toBe("Sqft");
    expect(normalizeUnit("  custom unit ")).toBe("custom unit");
    expect(normalizeUnit(null)).toBe("");
  });

  it("returns undefined for unknown units", () => {
    expect(unitDef("zzz-not-a-unit")).toBeUndefined();
    expect(unitDef(undefined)).toBeUndefined();
  });

  it("knows area units and the area a length gives", () => {
    expect(isAreaUnit("Sqft")).toBe(true);
    expect(areaUnitFor("Mtr")).toBe("Sqm");
    expect(areaUnitFor("unknown")).toBe("Sqft");
  });

  it("converts between units of the same kind", () => {
    expect(convertUnit(100, "Sqft", "Sqm")).toBeCloseTo(9.2903, 3);
    expect(convertUnit(1, "Mtr", "Cm")).toBeCloseTo(100, 6);
  });

  it("refuses to convert across kinds", () => {
    expect(convertUnit(1, "Sqft", "Mtr")).toBeNull();
  });
});
