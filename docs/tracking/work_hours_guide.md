# Work hours estimation guide

## AI-assisted development model

All code in this project is **AI-generated**. The human effort is in
**specification, direction, review, and validation** — not in typing code.
The formula accounts for this by using higher lines-per-hour rates than
traditional hand-coding, then adding back time for the human work that
drives the AI.

| Activity | Who | Typical share of effort |
|----------|-----|------------------------|
| Writing specs, requirements, design docs | Human | 25–40 % |
| Prompt crafting and iteration | Human | 10–20 % |
| Code generation | AI | — (near-zero clock time) |
| Review, correction, re-prompting | Human | 15–25 % |
| Integration testing and validation | Human | 15–25 % |

The rates in the tier table below already reflect AI-speed code generation.
The adjustment table adds back the human orchestration overhead.

## Estimating hours

Hours are derived from **git diff stats** combined with a **work-type rate**.

### Step 1 — Collect diff stats

Run one of:

```bash
git diff --cached --stat   # staged changes (before commit)
git show HEAD --stat       # most recent commit
```

Record three numbers:

| Stat | Variable |
|------|----------|
| Files changed | `files` |
| Insertions (+) | `ins` |
| Deletions (−) | `del` |

**Total changed lines:** `total_lines = ins + del`

### Step 2 — Classify the work

Pick the tier that best describes the **majority** of the change set.
When a commit spans tiers, split the lines by tier and sum the partial hours.

| Tier | Type | Rate (lines / hour) | Examples |
|------|------|---------------------|----------|
| 1 | Mechanical / bulk | 1 000–2 000 | Delete `dist/`, bulk renames, `.gitignore` updates, config-only tweaks |
| 2 | Standard application | 300–600 | CRUD endpoints, UI pages/forms, route wiring, straightforward middleware |
| 3 | Complex / specialized | 100–250 | Auth flows, DB schemas & migrations, Terraform / IaC, security hardening |
| 4 | Deep integration / architecture | 40–100 | Cross-service auth, webhook pipelines, performance tuning, design + investigation |

These rates assume **AI generates the code**. Choose the **lower end** of
the range when significant human review or re-prompting was needed; use the
**higher end** when the AI output was accepted with minimal edits.

### Step 3 — Calculate base hours

```
base_hours = total_lines / rate
```

### Step 4 — Apply adjustments

#### Human orchestration (always applies — pick one)

| Spec / direction effort | Adjustment | When to use |
|-------------------------|------------|-------------|
| Light — single clear prompt, accepted first try | +25 % | Trivial or well-understood changes |
| Moderate — spec writing, 2–4 prompt rounds, some review | +50 % | Typical feature work |
| Heavy — detailed design doc, many iterations, significant review | +75 % | New subsystems, multi-service changes, unfamiliar domains |

#### Situational modifiers (stack as applicable)

| Condition | Adjustment |
|-----------|------------|
| Changes span **10+ files** across multiple packages | +15 % |
| Significant **manual testing or validation** required | +20 % |
| Work includes **documentation or runbooks** alongside code | +10 % |

```
adjusted_hours = base_hours × (1 + orchestration% + sum of situational%)
```

### Step 5 — Round and floor

- Round to the nearest **0.5 h**.
- Minimum billable unit: **0.5 h**.

```
estimated_hours = max(0.5, round_to_half(adjusted_hours))
```

### Step 6 — Cross-check

Compare the number against the **conversation narrative**. If the stats
produce 2 h but the conversation describes a multi-hour investigation
with several false starts, favor the higher honest estimate. If stats
produce 10 h but the change was a single scripted migration, favor the
lower realistic number.

---

## Worked example

```
git show HEAD --stat
 15 files changed, 1 420 insertions(+), 380 deletions(-)
```

1. `total_lines = 1420 + 380 = 1800`
2. Work is mostly new API endpoints + UI pages → **Tier 2** at 400 lines/h.
3. `base_hours = 1800 / 400 = 4.5`
4. User wrote a spec and iterated 3 prompt rounds → **moderate orchestration (+50 %)**.
   Changes span 15 files across 3 packages → **+15 %**.
   `4.5 × (1 + 0.50 + 0.15) = 4.5 × 1.65 = 7.43`
5. Round → **7.5 h**
6. Cross-check: conversation involved spec drafting, CRUD + forms + wiring,
   and review — 7.5 h feels right. Final: **7.5 h**.

---

## Ledger entry format

Each entry in `docs/tracking/work_hours.md` has these parts in order:

```
- `YYYY-MM-DD` `SHORT_SHA` **N h**
  `F files | +INS −DEL | Tier T | ORCHESTRATION orchestration`
  Lay summary: One short sentence in plain English for non-technical readers.
  Invoice description line 1
  Invoice description line 2
  …
```

### Header line

`- \`YYYY-MM-DD\` \`SHORT_SHA\` **N h**`

### Metrics line (required)

A single backtick-wrapped line immediately after the header containing:

| Field | Source | Example |
|-------|--------|---------|
| **F files** | `git diff --stat` file count | `30 files` |
| **+INS −DEL** | insertions and deletions from stat output | `+5 592 −2` |
| **Tier T description** | tier + type label from Step 2 (single or slash-separated) | `Tier 2 standard` or `Tier 2 standard / Tier 3 complex` |
| **Orchestration** | human effort level from Step 4 | `Light`, `Moderate`, or `Heavy` |

Optional **non-billable** flag (invoice tooling), either form:

1. **Header suffix:** after the hours token, add ` (NOT-BILLABLE)` or ` (NOT_BILLABLE)` (parentheses, hyphen or underscore, case-insensitive), for example  
   ``- `2026-04-07` `927ed6b` **4 h** (NOT-BILLABLE)``
2. **Metrics segment:** append a final pipe segment **`NOT_BILLABLE`** or **`NOT-BILLABLE`** on the metrics line, for example  
   `` `30 files | +100 −0 | Tier 2 standard | Light orchestration | NOT_BILLABLE` ``.

The entry still appears on generated invoices with **NON-BILLABLE** on the line item, but those hours are **not** included in the invoice **Total (billable)**.

### Lay summary (recommended)

One indented line immediately **after** the metrics line (and **before** the invoice description):

`Lay summary: …` (capitalization as shown; label is case-insensitive for tooling.)

- **Audience:** someone with no software background (plain words only).
- **Length:** one sentence.
- **Content:** what changed for the **business or user**, not stack names, repos, or file counts.

**Agent-written entries:** add this line when you edit `work_hours.md` before commit (`Work-hours-logged: true`).

**Post-commit hook** (`scripts/append-work-hours.mjs`): if the commit body includes a trailer line  
`Lay-summary: …` (same sentence, one line), the hook copies it into the ledger as `Lay summary: …`. If omitted, the Word invoice script still builds a **fallback** summary from the description text.

### Invoice description (5–7 lines)

Written for a **client audience** — what was delivered, not how it was built.

| Estimated hours | Description lines |
|-----------------|-------------------|
| ≤ 1.5 h | 5 |
| 1.5 – 8 h | 6 |
| > 8 h | 7 |

#### Style

- Lead with a **bold summary sentence** describing the deliverable.
- Remaining lines expand on what the client receives.
- Avoid internal jargon, file counts, migration mechanics, and "why we did it"
  engineering notes unless the client would expect them.
- Each line should be a **complete thought**, not a bullet fragment.
