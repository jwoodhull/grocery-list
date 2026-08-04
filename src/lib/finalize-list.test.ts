import { describe, expect, it } from "vitest";
import type { FinalizedList, GroceryItem, MealPlanEntry } from "../types/index.js";
import { FinalizedListValidationError, groupByCategory, validateFinalizedList } from "./finalize-list.js";

const dinner: MealPlanEntry = { id: "chicken-tacos", name: "Chicken Tacos", servings: 4, mealType: "dinner" };

const validList: FinalizedList = {
  weekOf: "2026-08-03",
  mealPlan: [dinner],
  groceryList: [
    { name: "chicken thighs", amount: 1.5, unit: "lb", category: "meat", isRepeat: false },
    { name: "taco shells", amount: 8, unit: "count", category: "pantry", isRepeat: false },
  ],
};

describe("validateFinalizedList", () => {
  it("returns the input unchanged when it is well-formed", () => {
    expect(validateFinalizedList(validList)).toEqual(validList);
  });

  it("accepts groceryList items with category/isRepeat omitted", () => {
    const list: FinalizedList = {
      weekOf: "2026-08-03",
      mealPlan: [dinner],
      groceryList: [{ name: "garlic", amount: 1, unit: "clove" }],
    };
    expect(validateFinalizedList(list)).toEqual(list);
  });

  it("throws when weekOf is missing", () => {
    const { weekOf, ...rest } = validList;
    expect(() => validateFinalizedList(rest)).toThrow(/weekOf/);
  });

  it("throws when weekOf is not in YYYY-MM-DD format", () => {
    expect(() => validateFinalizedList({ ...validList, weekOf: "08/03/2026" })).toThrow(/weekOf/);
  });

  it("throws when mealPlan is missing", () => {
    const { mealPlan, ...rest } = validList;
    expect(() => validateFinalizedList(rest)).toThrow(/mealPlan/);
  });

  it("throws when mealPlan is not an array", () => {
    expect(() => validateFinalizedList({ ...validList, mealPlan: "nope" })).toThrow(/mealPlan/);
  });

  it("throws when a mealPlan entry is missing a required field", () => {
    expect(() =>
      validateFinalizedList({ ...validList, mealPlan: [{ id: "x", servings: 4, mealType: "dinner" }] }),
    ).toThrow(/mealPlan\[0\]\.name/);
  });

  it("throws when a mealPlan entry has an invalid mealType", () => {
    expect(() =>
      validateFinalizedList({ ...validList, mealPlan: [{ ...dinner, mealType: "brunch" }] }),
    ).toThrow(/mealPlan\[0\]\.mealType/);
  });

  it("throws when a mealPlan entry has non-positive servings", () => {
    expect(() =>
      validateFinalizedList({ ...validList, mealPlan: [{ ...dinner, servings: 0 }] }),
    ).toThrow(/mealPlan\[0\]\.servings/);
  });

  it("throws when groceryList is missing", () => {
    const { groceryList, ...rest } = validList;
    expect(() => validateFinalizedList(rest)).toThrow(/groceryList/);
  });

  it("throws when groceryList is not an array", () => {
    expect(() => validateFinalizedList({ ...validList, groceryList: {} })).toThrow(/groceryList/);
  });

  it("throws when a groceryList item is missing name", () => {
    expect(() =>
      validateFinalizedList({ ...validList, groceryList: [{ amount: 1, unit: "cup" }] }),
    ).toThrow(/groceryList\[0\]\.name/);
  });

  it("throws when a groceryList item has a negative amount", () => {
    expect(() =>
      validateFinalizedList({ ...validList, groceryList: [{ name: "garlic", amount: -1, unit: "clove" }] }),
    ).toThrow(/groceryList\[0\]\.amount/);
  });

  it("accepts a groceryList item with a zero amount (e.g. 'to taste')", () => {
    const list: FinalizedList = {
      weekOf: "2026-08-03",
      mealPlan: [dinner],
      groceryList: [{ name: "salt", amount: 0, unit: "to taste" }],
    };
    expect(validateFinalizedList(list)).toEqual(list);
  });

  it("throws when a groceryList item is missing unit", () => {
    expect(() =>
      validateFinalizedList({ ...validList, groceryList: [{ name: "garlic", amount: 1, unit: "" }] }),
    ).toThrow(/groceryList\[0\]\.unit/);
  });

  it("throws when a groceryList item has an invalid category", () => {
    expect(() =>
      validateFinalizedList({
        ...validList,
        groceryList: [{ name: "garlic", amount: 1, unit: "clove", category: "spices" }],
      }),
    ).toThrow(/groceryList\[0\]\.category/);
  });

  it("throws when a groceryList item has a non-boolean isRepeat", () => {
    expect(() =>
      validateFinalizedList({
        ...validList,
        groceryList: [{ name: "garlic", amount: 1, unit: "clove", isRepeat: "yes" }],
      }),
    ).toThrow(/groceryList\[0\]\.isRepeat/);
  });
});

describe("groupByCategory", () => {
  it("groups items into the fixed category order, omitting empty categories", () => {
    const items: GroceryItem[] = [
      { name: "napkins", amount: 1, unit: "pack", category: "household" },
      { name: "chicken thighs", amount: 1.5, unit: "lb", category: "meat" },
      { name: "milk", amount: 1, unit: "gal", category: "dairy" },
    ];
    expect(groupByCategory(items).map((g) => g.category)).toEqual(["dairy", "meat", "household"]);
  });

  it("keeps multiple items in a category together, preserving original order", () => {
    const items: GroceryItem[] = [
      { name: "chicken thighs", amount: 1.5, unit: "lb", category: "meat" },
      { name: "ground beef", amount: 1, unit: "lb", category: "meat" },
    ];
    const groups = groupByCategory(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.name)).toEqual(["chicken thighs", "ground beef"]);
  });

  it("passes isRepeat through unchanged", () => {
    const items: GroceryItem[] = [{ name: "salad", amount: 1, unit: "bag", category: "produce", isRepeat: true }];
    expect(groupByCategory(items)[0]?.items[0]?.isRepeat).toBe(true);
  });

  it("returns an empty array for an empty item list", () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it("throws FinalizedListValidationError when an item has no category", () => {
    const items: GroceryItem[] = [{ name: "garlic", amount: 1, unit: "clove" }];
    expect(() => groupByCategory(items)).toThrow(FinalizedListValidationError);
    expect(() => groupByCategory(items)).toThrow(/garlic/);
  });

  it("throws, rather than silently dropping the item, when an item has an invalid category", () => {
    const items: GroceryItem[] = [
      // @ts-expect-error - intentionally invalid for the test
      { name: "garlic", amount: 1, unit: "clove", category: "Produce" },
    ];
    expect(() => groupByCategory(items)).toThrow(FinalizedListValidationError);
    expect(() => groupByCategory(items)).toThrow(/garlic/);
  });
});
