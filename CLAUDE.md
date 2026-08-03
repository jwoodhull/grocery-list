# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Stage 1 (MVP tracer bullet) is complete: recipes load from `data/recipes/*.json`, `build-grocery-list.ts` merges their ingredients (exact name+unit dedup only) and reports dinner-coverage against eaters/dinners needed. No skill, pantry, repeating items, scaling, or unit conversion yet. The full staged build plan and current stage is tracked in `spec/tech-spec.md` §6; work proceeds stage by stage from there.

## Implementation approach

Decided (see `spec/tech-spec.md` for the full rationale, schemas, and module boundaries): a **Claude Code skill** (`.claude/skills/plan-week/`, not yet built) backed by deterministic, unit-tested TypeScript under `/src`. Judgment calls (recipe-text parsing, conversational flow, HTML artifact composition) stay in the skill's `SKILL.md`; deterministic logic (dedup, scaling, unit conversion, cadence math, pantry matching) lives in tested `/src/lib` functions with thin `/src/cli` wrappers. Storage is plain CSV/JSON under `/data` — no database, no server, no auth.

## Commands

- `npm install` — install dependencies
- `npm test` — run the Vitest suite once (`vitest run`)
- `npm run test:watch` — Vitest in watch mode
- `npm run typecheck` — `tsc --noEmit`
- `npx tsx src/cli/<name>.ts [args]` — run any CLI script directly, no build step (e.g. `npx tsx src/cli/hello.ts --a 2 --b 3`)

Tests are colocated as `*.test.ts` next to the module they cover (e.g. `src/lib/hello.ts` + `src/lib/hello.test.ts`). Every `/src/cli` script prints one JSON object to stdout and exits non-zero with a stderr message on error.

## What this project is

A weekly meal-plan / grocery-list planner. `spec/grocery-list-spec.md` is the product spec; `spec/tech-spec.md` is the technical spec (architecture, schemas, phased stages) — read the latter before making implementation decisions.

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
