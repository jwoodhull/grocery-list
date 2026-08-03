import { describe, expect, it } from "vitest";
import { computeCoverage } from "./servings.js";

describe("computeCoverage", () => {
  it("is trivially covered with no planned meals and zero dinners needed", () => {
    const result = computeCoverage([], 0, 2);
    expect(result.dinnersPlanned).toBe(0);
    expect(result.dinnersRemaining).toBe(0);
    expect(result.isFullyCovered).toBe(true);
    expect(result.slots).toEqual([]);
  });

  it("reports all dinners remaining with no planned meals and dinners needed", () => {
    const result = computeCoverage([], 6, 2);
    expect(result.dinnersPlanned).toBe(0);
    expect(result.dinnersRemaining).toBe(6);
    expect(result.isFullyCovered).toBe(false);
  });

  it("flags an exact slot", () => {
    const result = computeCoverage([{ recipeId: "chicken-tacos", servings: 2 }], 6, 2);
    expect(result.slots[0]).toEqual({
      recipeId: "chicken-tacos",
      servings: 2,
      eatersNeeded: 2,
      status: "exact",
      shortfall: 0,
      nightsCovered: 1,
    });
  });

  it("flags an under slot", () => {
    const result = computeCoverage([{ recipeId: "soup", servings: 1 }], 6, 2);
    expect(result.slots[0]).toEqual({
      recipeId: "soup",
      servings: 1,
      eatersNeeded: 2,
      status: "under",
      shortfall: 1,
      nightsCovered: 0,
    });
  });

  it("flags an over slot and counts multiple nights", () => {
    const result = computeCoverage([{ recipeId: "chili", servings: 8 }], 6, 2);
    expect(result.slots[0]).toEqual({
      recipeId: "chili",
      servings: 8,
      eatersNeeded: 2,
      status: "over",
      shortfall: 0,
      nightsCovered: 4,
    });
  });

  it("aggregates multiple planned meals toward dinnersNeeded", () => {
    const result = computeCoverage(
      [
        { recipeId: "a", servings: 2 },
        { recipeId: "b", servings: 2 },
        { recipeId: "c", servings: 2 },
      ],
      6,
      2,
    );
    expect(result.dinnersPlanned).toBe(3);
    expect(result.dinnersRemaining).toBe(3);
    expect(result.isFullyCovered).toBe(false);
  });

  it("throws RangeError for zero eatersPerDinner", () => {
    expect(() => computeCoverage([], 6, 0)).toThrow(RangeError);
  });

  it("throws RangeError for negative dinnersNeeded", () => {
    expect(() => computeCoverage([], -1, 2)).toThrow(RangeError);
  });

  it("throws RangeError for a non-integer eatersPerDinner", () => {
    expect(() => computeCoverage([], 6, 2.5)).toThrow(RangeError);
  });

  it("throws RangeError for a non-integer dinnersNeeded", () => {
    expect(() => computeCoverage([], 5.5, 2)).toThrow(RangeError);
  });
});
