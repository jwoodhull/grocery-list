# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository is pre-implementation. It currently contains only a product spec (`spec/grocery-list-spec.md`) and an empty `src/` directory — no build system, dependencies, or tests exist yet. There are no commands to run until an implementation approach is chosen and scaffolded.

## What this project is

A weekly meal-plan / grocery-list planner (see `spec/grocery-list-spec.md` for the full spec). The spec explicitly leaves the implementation form open — it could be a standalone script, a Claude skill, or an HTML artifact — so when starting implementation, confirm which form the user wants before scaffolding.

Core workflow described by the spec:
1. Plan dinners for the week (default 6 dinners, default 2 eaters/dinner), plus optional extra recipes (desserts, breakfasts, lunches).
2. Build a de-duplicated grocery list from recipe ingredients, scaled to servings needed.
3. Merge in recurring items (bought every week, e.g. salad) and cadence-based items (bought every N weeks, e.g. salad dressing biweekly, napkins monthly).
4. Let the user review/edit the list, marking items already on hand (checked against the Pantry).
5. Output an HTML artifact containing the meal plan and grocery list.
6. Update the Pantry based on what was purchased.

Core data entities:
- **Pantry**: ingredients on hand — name, amount on hand, unit.
- **Recipe**: name, servings made, ingredient list with amounts, steps, optional source URL. Some meals are ingredient/serving lists without a full recipe (e.g. "Grilled Salmon, no recipe needed").
- **Repeated Items**: ingredients bought every week, seeded from a starter list.
- (Implied by the cadence user story) recurring items may also need an N-week cadence, not just weekly.

Key behaviors called out in the spec worth preserving in any implementation:
- If a recipe's servings don't match eaters needed for a dinner slot, the user should be prompted to scale the recipe (double/triple), and the ingredient list should update accordingly.
- When new items appear repeatedly across grocery lists, the system should notice and offer to add them to the Repeated Items list.
- The grocery list should flag items the user may already have in the Pantry rather than silently omitting or including them.
