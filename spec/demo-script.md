# Demo script: 10-15 min engineering walkthrough

Interview-style demo, hard-capped at 10-15 minutes. Judged on: how the
project was scoped, where the agent went well/wrong, how I iterated, how I
reviewed output, how I tested, and producing an artifact I can explain in
depth — with explicit emphasis on judgment/ownership and iterating through
dead ends, not just the finished product.

This walks through the **real, unedited build history** on `main` and the
Stage 3 session — no re-performed "clean" version. The real history already
contains a genuine correctness bug the agent introduced and I caught via
code review, a real dependency judgment call, a real manual-review catch,
and a mistake I made live while fixing something, caught by testing within
seconds. That's stronger evidence than a rehearsed redo.

## Segment outline (~15 min; cut bracketed-optional beats to fit 10)

**[0:00-1:00] Hook — what this is**
One sentence: a weekly meal-plan/grocery-list tool, built as a Claude Code
skill backed by tested TypeScript. Show `spec/grocery-list-spec.md`
briefly — this is 100% the input, no implementation detail in it.

**[1:00-2:30] Scoping**
Show the actual original prompt (verbatim, from session `8a757ba0`,
before `git show 1f99dc7 --stat` / `spec/tech-spec.md` even existed):

> \# planning the tech spec for grocery list
>
> The product spec should be implemented as a skill, with scripts for
> deterministic parts and simple csv and json files for data storage. The
> current project should contain all of the data, scripts and skills.
>
> Each coding phase should end with a set of tests, and verification.
>
> Write the tech spec to /spec/tech-spec.md
>
> \# Locations
>
> /src for scripts
> /data/recipes -- stored recipes
> /data/pantry.csv -- pantry state
> /data/repeating.csv -- repeating items and cadence
>
> \# Language
>
> write the scripts in Typescript
>
> \# Execution Env
>
> Execute w/ nodejs
> test scripts with ViTest
>
> \#\# Stages
>
> Set up environment
>
> Plan MVP tracer bullet
> Plan meals, collect recipe, generate de-dupped list
>
> Then plan each additional feature.

Talking points:
- This is *compact* direction, not a fully-specified doc — locations, a
  language/runtime choice, "tests + verification every phase," and a
  stage order. Worth noting: two earlier turns in that same session tried
  "let's discuss the approach first," got interrupted, and were redirected
  ("do not start planning") before landing on this structured note —
  scoping wasn't a single perfect shot either.
- What Claude expanded on its own from that: the full data schemas, the
  `/src/lib` (tested) vs. `SKILL.md` (conversational) module boundary, and
  the Build / Tests / Verify / Exit-criteria structure every stage in
  `spec/tech-spec.md` §6 now follows. Good beat for "orchestrating AI
  tools effectively" — compact human direction, agent fills in structure,
  human reviews the result next (see step 3).

**[2:30-4:00] Agent went well — the tracer bullet**
`git show ac61856 --stat`. Show `src/lib/grocery-list.ts` +
`grocery-list.test.ts` and a green `npm test`. Talking point: smallest
slice that exercises the real pipeline (load recipe → compute coverage →
merge ingredients) end to end before any polish — cheap to verify, cheap
to build on.

**[4:00-4:45] Stage 2, quick beat**
`.claude/skills/plan-week/SKILL.md` — the conversational orchestration
layer that calls the tested CLI scripts and reasons over JSON. One line:
judgment calls (parsing pasted recipes, wording) stay here; deterministic
logic stays tested. Don't linger.

**[4:45-8:30] THE MEAT — where the agent went wrong, and how it was caught**
This is the core of the rubric. Show, in order:
1. TDD for Stage 3: `src/lib/finalize-list.test.ts` written and run red
   *before* `src/lib/finalize-list.ts` existed — brief, just prove the
   discipline was real.
2. `/code-review high` on the finished Stage 3 diff came back with 8
   findings, ranked most-severe first — 3 correctness, 3 duplication, 1
   simplification, 1 architecture note. The headline one: a real
   correctness bug at `src/lib/recipes.ts:146-147`, which allows
   ingredient `amount >= 0` (zero is valid — "salt, to taste"), while the
   newly-written `finalize-list.ts` required `amount > 0` — two
   hand-written validators for the same concept had silently drifted.
   Show both lines side by side. Worth naming on camera that this class
   of bug (two parallel validators disagreeing) is exactly what happens
   when review doesn't run — it wouldn't have shown up in the tests
   *because both validators had their own internally-consistent test
   suite*; it only surfaced by comparing the two against each other.
3. The fix: extracted `isNonEmptyString`/`isFiniteNumber` into
   `src/lib/validation.ts` (shared by both), and `finalize-list.ts` now
   uses `requireNonNegativeNumber` to match `recipes.ts`'s actual rule
   (`src/lib/finalize-list.ts:29,59`). Point out this is the deeper fix,
   not a patch — one shared source of truth instead of two.
4. Same code-review pass also caught a *silent data-loss* bug:
   `groupByCategory` only checked `category === undefined`, so an
   invalid-but-defined category would silently vanish from the output
   instead of erroring. Fixed by validating against the enum, not just
   presence.
5. **The best "iterating through a dead end" moment, because it's
   completely real and happened live**: while fixing the shell-quoting
   issue (an apostrophe in a recipe name like "Shepherd's Pie" breaking a
   `--data '<json>'` shell argument), I added a `--dataFile` CLI flag but
   named the option wrong — `node:util.parseArgs` needs the option key to
   exactly match, and I'd written `data-file` instead of the camelCase
   `dataFile` the rest of the codebase uses. Running it live immediately
   errored (`Unknown option '--data-file'`), caught in seconds, fixed,
   re-verified. Show that terminal output if you kept it — it's a real
   mistake-and-catch, not staged.

**[8:30-9:30] How output was reviewed**
Two real manual-review moments, worth 30-45 sec each — verbatim prompts,
straight from the transcript (`notes/stage-3-cr.txt`):

1. *"validate.ts line 11 both of these validators feel like overkill. Are
   there functions we could use from node?"* — pointed at
   `src/lib/validation.ts:13` (`isFiniteNumber`). The agent's answer:
   `Number.isFinite` (unlike the global `isFinite`) never coerces its
   argument, so it already rejects non-numbers on its own — the manual
   `typeof value === "number"` check was dead code, only there because
   `Number.isFinite`'s TS signature isn't a type predicate. Kept the
   predicate wrapper (needed for narrowing), dropped the redundant
   runtime check. `isNonEmptyString` right next to it, by contrast,
   *doesn't* have a native equivalent — good beat to show a reviewer
   asking the same question twice and getting two different, correct
   answers instead of a reflexive "sure, simplified" both times.
2. *"I'm seeing changes to recipes.ts that are if logic changes, but no
   tests of those edge cases"* — after the shared-predicate refactor
   touched `recipes.ts`'s validation. There was a real gap: the refactor
   was meant to be behavior-preserving, but `ingredient.amount === 0`
   being accepted (the exact boundary the whole amount-mismatch bug hinged
   on) had never been asserted either way. Added three regression tests
   (`recipes.test.ts`) — non-finite servings, non-finite amount, and the
   zero-amount boundary — then re-ran the suite to prove the refactor
   really was behavior-preserving instead of just asserting it. This is
   the "verifying outputs, not rubber-stamping" beat.

**[9:30-10:30] Judgment / ownership**
The "should we use a schema-validation library" conversation.
Recommendation was **not** to add Zod now — current validation surface is
two small files, and this project's own conventions explicitly favor
minimal dependencies. Instead documented a conditional Stage 11 in
`spec/tech-spec.md`, triggered only if the validated-shape count actually
grows in later stages. Talking point: judgment isn't just catching bugs,
it's also *not* reaching for a tool just because it's available.

**[10:30-13:30] Testing in depth + the artifact**
- TDD discipline recap (red before green, throughout).
- The full manual end-to-end run of the real skill: reused a recipe,
  pasted a new one with an apostrophe in the name (deliberately
  re-exercising the shell-quoting fix), added a manual/no-recipe entry,
  handled an over-coverage case honestly instead of forcing a fake
  "exactly covered" result, made a live review edit (removed an item,
  merged a duplicate), then finalized.
- Open the published artifact and explain it in depth: five fixed
  grocery categories in a stable order, empty categories omitted rather
  than shown blank, a repeat-item badge that's wired up but inert
  (nothing sources it until a not-yet-built stage), fonts embedded as
  local data URIs so the page has zero external dependencies.

**[13:30-14:45] Wrap — the leverage, stated explicitly**
Recap in concrete terms, not vibes: a real correctness bug caught before
it shipped (not after), duplicate logic collapsed to one source of truth
after it had already drifted once, a dependency deliberately deferred
with a documented trigger instead of reflexively added, and a live
mistake caught by testing within seconds rather than discovered later.
That's the leverage — not "the agent wrote code fast," but "the loop of
TDD + review + testing kept a fast-moving agent honest."

**[14:45-15:00] Buffer**

## What to have open/ready before recording

- Terminal in this repo, `git log --oneline` handy.
- `spec/grocery-list-spec.md`, `spec/tech-spec.md` §6.
- `src/lib/recipes.ts:146-147`, `src/lib/finalize-list.ts:29,59`,
  `src/lib/validation.ts:4,13`.
- The `/code-review` findings from the Stage 3 session (or
  `git show 4061fde` to see the diff they applied to).
- The published artifact URL:
  `https://claude.ai/code/artifact/cd4aa016-fec2-451f-9a2e-d009fac4d319`.
- `npm test` ready to run for a live green-suite moment.
