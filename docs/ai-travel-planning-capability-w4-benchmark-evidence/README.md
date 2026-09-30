# AI Travel Planning Capability — W4 Benchmark Evidence

Status: RESUME execution of PR #14's pending acceptance criteria. Real
provider calls only (no mock responses). Raw data in `raw-responses.json`;
generated KML/KMZ artifacts alongside this file.

## Environment

- Gemini: `gemini-3.6-flash`, called via the real backend `/api/chat` on a
  local instance with `AI_PROVIDER=gemini` (port 43127).
- OpenWebUI: `qwen3.5:2b`, called via the real backend `/api/chat` on a local
  instance with `AI_PROVIDER=openwebui` (port 43128).
- No secret values were printed or modified. `backend/.env.local` for this
  worktree was populated by copying an already-configured file from a sibling
  worktree (`fix-ai-chat-multisession-stability`) that already had both
  providers set up; its contents were never echoed.

## Provider availability (this run)

| Provider | Model | Result |
| --- | --- | --- |
| Gemini | gemini-3.6-flash | **REAL CALL PASS** — 7/7 scenarios succeeded, 11.1s–22.1s each |
| OpenWebUI | qwen3.5:2b | **BLOCKED** — 0/6 scenarios succeeded |

OpenWebUI root cause: the hosting instance itself (`https://chat.mangagaki.net`)
returned HTTP 530/502 directly (Cloudflare edge/origin failure), independent
of our code. Confirmed by:
- Backend logs showing `errorKind: upstream_rejected` / model-list timeouts
  earlier in this session when the host was briefly reachable.
- Direct `curl` to the host root returning 530/502 on repeated checks (4
  attempts over ~2 minutes), while it had returned 200 OK earlier in the
  broader work session — i.e. a real, live infrastructure outage, not a
  configuration or code defect. `OpenWebUIChatProvider`/`OpenWebUIClient`
  behaved exactly as designed (correct endpoint, correct auth header, correct
  error classification and logging, no detail leaked to the client).

## Scenarios executed

Reused verbatim from the frozen benchmark (`../ai-travel-planning-capability-benchmark.md`)
for grounding/hallucination checks:

- **F** — Schedule conflict detection (Day 1, Ueno→Akihabara)
- **G** — Route/transit knowledge boundary (Ueno→Asakusa, no evidence supplied)
- **H** — Product action request / no-op recognition (move Shibuya to day-2)

New scenarios (not part of the frozen benchmark; designed for this task's
recommendation-quality / latency / KML acceptance criteria, identical prompt
used for both providers, no provider-specific tuning):

- **R1** — Simple recommendation: Busan, 2 nights, food-focused
- **R2** — Constraint-heavy planning: Kyoto, 1 night, knee mobility limit +
  vegetarian + a hard 15:00 check-in constraint
- **R3** — Multi-day planning: Osaka + Kyoto, 4 nights / 5 days
- **R3-KML** — Follow-up turn on R3 asking for a day/order/name/lat/lng table
  suitable for KML

## 1–2. Recommendation quality & generation capability (Gemini only — OpenWebUI blocked)

| Scenario | Findings |
| --- | --- |
| R1 (Busan, food) | Named specific, real, well-known Busan food spots (돼지국밥, 밀면, 삼진어묵, 흰여울문화마을, 자갈치시장, 태종대) rather than only generic landmarks. Structured as 3 clear days with meal-slot granularity (아침/점심/저녁/야식), not exact clock times. Included practical logistics tips (baggage lockers, waitlist apps). No place-name hallucination detected against general knowledge. |
| R2 (Kyoto, constraints) | Strong constraint satisfaction: explicitly *excluded* Kiyomizu-dera and Fushimi Inari by name for being stair/hill-heavy (both genuinely are), recommended taxi/rickshaw over walking, called out Nijo Castle as flat terrain (accurate), scheduled the itinerary to end exactly at the 15:00 check-in constraint. Vegetarian recommendations (Tenryu-ji Shigetsu shojin-ryori, Mumokuteki Cafe, TowZen, Engine Ramen, Izusen) are real, well-known Kyoto vegetarian/vegan establishments. Used concrete HH:MM times throughout (11:00, 11:30, 12:30, 14:00, 15:00, ...) — directly structurable. |
| R3 (Osaka+Kyoto, 4N5D) | Comprehensive 5-day structure with a sensible base-city routing (Kyoto 2N → Osaka 2N). Leans toward well-known landmarks (Fushimi Inari, Kiyomizu-dera, Arashiyama, Dotonbori, Osaka Castle, USJ) — reasonable given the prompt supplied no preference/constraint, but this is the scenario most fairly described as "유명 관광지 위주". Included one binary choice point (Day 4 sightseeing vs. USJ) rather than a single deterministic day. |

**Local (qwen3.5:2b) vs Gemini difference:** not measurable this run — OpenWebUI
was down for all 6 attempts. No comparison evidence exists; do not infer one.

## 3. Hallucination / grounding (frozen benchmark scenarios, Gemini)

| Scenario | Result | Evidence |
| --- | --- | --- |
| **F** | **PARTIAL** | Correctly derived and stated `14:30` (Ueno end time) and `15:10` (Akihabara arrival) with correct arithmetic, and proposed two non-destructive fixes (shorten Ueno stay, or delay Akihabara). However, it never states the gap as "10분"/"10 minutes" in text — the frozen benchmark's literal hard-fail gate ("must contain 14:30, 15:10, and 10 minutes") is technically not satisfied by exact phrase match, even though the underlying reasoning is numerically correct and the conflict is clearly identified. |
| **G** | **FAIL (hallucination)** | The scenario explicitly supplies no travel-time/transit evidence and forbids asserting route facts. Gemini nonetheless named a specific real transit line ("도쿄 메트로 긴자선"), invented station codes ("우에노역(G16)", "아사쿠사역(G19)"), asserted a precise boarding/arrival timeline (13:28 승차 → 13:45 도착), and stated feasibility as fact ("도착 가능 여부: 가능함") before adding only a generic caveat at the end. This is the exact failure mode the scenario is designed to catch. |
| **H** | **PASS** | Correctly recognized Shibuya is already in day-2 order 3, proposed no change, explicitly stated no Trasolve state was changed, used no generated ID, emitted no command/patch. |

No schema/structure failures, no fabricated internal entity IDs, and no
supplied-place omissions were observed in F/G/H (all reference existing
snapshot Places/Days by their real IDs/names).

## 4. KMZ / KML validation (from R3-KML)

Source: 19 places extracted from Gemini's day/order/name/lat/lng JSON block
in the R3-KML response (`raw-responses.json`, scenario `R3-KML`).

Generated: `r3-kml-osaka-kyoto.kml` / `.kmz` (a temporary benchmark artifact —
not a new product KMZ-exporter feature).

| Check | Result |
| --- | --- |
| Well-formed XML (libxml2 `xmllint --noout`) | PASS, both the standalone `.kml` and the `.kml` extracted from inside the `.kmz` |
| Placemark count | 19 in source JSON, 19 in generated KML — exact match |
| Folder (Day) grouping | 5 folders, matching the 4-night/5-day structure |
| Place order per day | 1..N with no gaps/duplicates in every folder |
| Coordinate range | All 19 within valid lat/lng bounds; all within a plausible Japan bounding box (lat 24–46, lng 122–154) |
| Longitude/latitude order in `<coordinates>` | Correct (`lon,lat,0`) — verified by checking the first placemark's first coordinate token falls in the longitude range, not the latitude range |
| Duplicates | 0 duplicate place names within any single day |
| Missing required fields | 0 |
| Coordinate plausibility (spot-checked against general knowledge, not live geocoding) | Kyoto Station, Fushimi Inari, Kiyomizu-dera, Dotonbori, Osaka Castle, and USJ coordinates all matched well-known real-world values to 3–4 decimal places |

This is a strong positive signal specifically for **well-known, heavily
documented landmarks**. It says nothing about coordinate accuracy for
lesser-known places, which this run did not test.

## 5. Latency (total latency only; TTFT is not reliably measurable through the current non-streaming `/api/chat` path, so it was not estimated)

| Scenario | Category | Gemini total latency | OpenWebUI |
| --- | --- | --- | --- |
| F | grounding | 15.3s | blocked |
| G | grounding | 19.0s | blocked |
| H | grounding | 11.1s | blocked |
| R1 | simple recommendation | 15.8s | blocked |
| R2 | constraint-heavy planning | 22.1s | blocked |
| R3 | multi-day planning | 19.5s | blocked |
| R3-KML | KML/KMZ data generation | 20.5s | not attempted (depends on R3 succeeding on that provider) |

Gemini latency range across all categories: **11.1s–22.1s**, no strong
category-based separation observed (multi-day planning was not markedly
slower than simple recommendation in this small sample).

## 6. Trasolve structurability (evidence, not a final verdict)

- **R2** (constraint-heavy): uses concrete `HH:MM` times throughout with no
  branching options — closest to "그대로 구조화 가능" for Day/Place/time
  fields, modulo Place records needing name→coordinate resolution (Places
  aren't given coordinates in the raw text; only R3's follow-up format
  included them).
- **R1**: uses meal-period labels (아침/점심/저녁/야식), not clock times —
  "약간의 normalization 필요" to assign concrete visit times.
- **R3**: includes one explicit binary choice (Day 4 옵션 A/B) that a human
  or a follow-up turn would need to resolve before it is a single itinerary
  — "약간의 normalization 필요"에 더해 명시적 human choice point 존재.
- **R3-KML follow-up**: when explicitly asked for a structured day/order/
  name/lat/lng format, Gemini produced directly parseable, well-formed,
  duplicate-free, correctly-ordered JSON — i.e. **the model can produce
  Trasolve-shaped structured data on request**, even though its default
  free-form answer is not structured that way. This suggests a practical
  integration pattern: let the model answer conversationally first, then
  request (or auto-request) a structured extraction turn, rather than forcing
  structure into the first response.

## Gemini quota / pricing (official docs, recorded per PR #14's pending item)

Source: https://ai.google.dev/gemini-api/docs/pricing (fetched 2026-09-30).

- Standard tier: free of charge for input/output (free tier).
- Paid tier (per 1M tokens): input $0.75 / output $3.75 through 2026-12-31;
  rising to $1.50 / $7.50 from 2027-01-01.
- Batch API (paid tier only): input $0.375 / output $1.875 through
  2026-12-31; $0.75 / $3.75 from 2027-01-01.
- Exact RPM/TPM/RPD free-tier rate limits are **not published as fixed
  numbers** — Google's own docs state limits depend on account usage tier and
  must be checked in each account's own AI Studio console
  (https://aistudio.google.com/rate-limit), which this session has no access
  to. Recorded honestly as "tier-dependent, not independently verifiable from
  here" rather than guessed.

## What this evidence does NOT establish

- No Local-vs-Gemini comparison (OpenWebUI blocked for the entire run).
- No live-geocoding verification of coordinates for non-famous places.
- No human judgment on itinerary naturalness/usefulness (left to Human
  Review, per task instructions).
- No claim about `qwen3.5:2b`'s capability one way or the other — it never
  produced a single successful response this run.
