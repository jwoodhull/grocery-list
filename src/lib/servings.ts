export type MealSlotStatus = "under" | "exact" | "over";

export interface PlannedMeal {
  recipeId: string;
  servings: number;
}

export interface MealSlotCoverage {
  recipeId: string;
  servings: number;
  eatersNeeded: number;
  status: MealSlotStatus;
  shortfall: number;
  nightsCovered: number;
}

export interface CoverageResult {
  dinnersNeeded: number;
  eatersPerDinner: number;
  slots: MealSlotCoverage[];
  dinnersPlanned: number;
  dinnersRemaining: number;
  isFullyCovered: boolean;
}

/**
 * Compares planned meals against the dinners/eaters needed for the week.
 *
 * Each planned meal is classified `under`/`exact`/`over` against `eatersPerDinner`,
 * and results are rolled up into an aggregate dinner-night count so a recipe that
 * serves more than `eatersPerDinner` correctly counts toward multiple nights.
 *
 * @param plannedMeals - The recipes selected so far, with their (possibly scaled) servings.
 * @param dinnersNeeded - Total dinner slots to fill this week.
 * @param eatersPerDinner - Eaters expected at each dinner.
 * @returns Per-slot coverage plus aggregate totals and whether the week is fully covered.
 * @throws {@link RangeError} If `eatersPerDinner` is not positive, or `dinnersNeeded` is negative.
 */
export function computeCoverage(
  plannedMeals: PlannedMeal[],
  dinnersNeeded: number,
  eatersPerDinner: number,
): CoverageResult {
  if (!Number.isInteger(eatersPerDinner) || eatersPerDinner <= 0) {
    throw new RangeError("eatersPerDinner must be a positive integer");
  }
  if (!Number.isInteger(dinnersNeeded) || dinnersNeeded < 0) {
    throw new RangeError("dinnersNeeded must be zero or a positive integer");
  }

  const slots: MealSlotCoverage[] = plannedMeals.map((meal) => {
    let status: MealSlotStatus = "exact";
    if (meal.servings < eatersPerDinner) status = "under";
    else if (meal.servings > eatersPerDinner) status = "over";
    return {
      recipeId: meal.recipeId,
      servings: meal.servings,
      eatersNeeded: eatersPerDinner,
      status,
      shortfall: Math.max(eatersPerDinner - meal.servings, 0),
      nightsCovered: Math.floor(meal.servings / eatersPerDinner),
    };
  });

  const dinnersPlanned = slots.reduce((sum, slot) => sum + slot.nightsCovered, 0);
  const dinnersRemaining = Math.max(dinnersNeeded - dinnersPlanned, 0);

  return {
    dinnersNeeded,
    eatersPerDinner,
    slots,
    dinnersPlanned,
    dinnersRemaining,
    isFullyCovered: dinnersPlanned >= dinnersNeeded,
  };
}
