# AI travel-planning capability benchmark v1

Status: frozen for Travel Planning Slice 1 — Capability Benchmark Freeze

This document is the provider-neutral evaluation package for the independent
task "AI 여행 계획 역량 및 Trasolve 조작 가능성 검증". Run it unchanged
against each model. Provider execution is outside this slice.

The benchmark evaluates a model's planning proposal. It does not define or
execute `TripCommand`, mutate a Trip, call product tools, or claim that a
proposed change has been applied.

## 1. Reproduction rules

1. Use the canonical snapshot and evidence in this document verbatim.
2. Start scenarios A–H in fresh conversations. Do not carry a response from
   one independent scenario into another.
3. Run scenario M only as the specified continuation of scenario B.
4. Send the common instruction, the scenario's exact supplied context, and
   its exact prompt without provider-specific additions.
5. Do not add live Place, Routes, transit, web, or general-knowledge evidence.
6. Preserve `null` as missing/unknown. Do not silently replace it with a
   guessed value.
7. Record the raw response and latency. Score only after the response is
   complete.
8. Product mutation expected for every scenario on current `origin/w2` is
   `NONE`.

### Common instruction

Send this exact instruction before the scenario context and user prompt:

```text
당신은 Trasolve 여행 계획 평가에 참여하고 있습니다. 제공된 사실, 제약, 사용자 선호, 누락 정보, 외부 근거를 구분하세요. 제공되지 않은 장소 정보, 이동시간, 노선, 운영시간을 사실처럼 만들지 마세요. 변경 요청에는 무엇을 왜 바꾸면 좋을지 계획 제안만 답하세요. Trasolve의 상태를 변경했거나 변경을 실행했다고 말하지 마세요. 답변은 한국어로 작성하고, 사용한 근거와 가정 또는 누락 정보를 명시하세요.
```

## 2. Canonical sample Trip snapshot

Canonical repository source:
`frontend/src/features/map-workspace/data/demoTrip.ts`.

The source is the UI/view-model sample used by "예시 여행 만들기". Its IDs
below are stable **benchmark reference IDs** copied from that source. They are
not the UUIDs of a persisted example Trip: creation omits Day IDs and the
backend assigns new Day, Place, and Polyline UUIDs. The source's display-only
period and Day date labels are also not persisted by the initial
`tripViewToInput(demoTrip)` conversion. This benchmark freezes the source
snapshot itself so every provider receives identical references.

An explicit `null` below means the source omits that value. It is not a value
inferred from general knowledge.

```json
{
  "benchmarkSnapshot": "trasolve-demo-trip-source-v1",
  "source": "frontend/src/features/map-workspace/data/demoTrip.ts",
  "identity": {
    "persistedTripId": null,
    "title": "도쿄, 3일의 여행",
    "periodLabel": "2026. 10. 12 — 10. 14",
    "startDate": null,
    "endDate": null
  },
  "days": [
    {
      "id": "day-1",
      "title": "Day 1",
      "dateLabel": "10월 12일",
      "date": null,
      "order": 1,
      "places": [
        {
          "id": "asakusa",
          "name": "센소지",
          "coordinates": { "lat": 35.7148, "lng": 139.7967 },
          "order": 1,
          "scheduledTime": "09:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "아사쿠사 · 사찰과 주변 거리",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "ueno",
          "name": "우에노 공원",
          "coordinates": { "lat": 35.7146, "lng": 139.7745 },
          "order": 2,
          "scheduledTime": "11:30",
          "visitDurationMinutes": 180,
          "preferredDurationMinutes": null,
          "memo": "우에노 · 공원 산책",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "akihabara",
          "name": "아키하바라",
          "coordinates": { "lat": 35.6984, "lng": 139.7731 },
          "order": 3,
          "scheduledTime": "15:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "아키하바라 · 거리 둘러보기",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        }
      ],
      "routeSegments": [
        {
          "id": "asakusa-ueno",
          "fromPlaceId": "asakusa",
          "toPlaceId": "ueno",
          "order": 1,
          "mode": "transit",
          "path": null,
          "durationMinutes": null
        },
        {
          "id": "ueno-akihabara",
          "fromPlaceId": "ueno",
          "toPlaceId": "akihabara",
          "order": 2,
          "mode": "walking",
          "path": null,
          "durationMinutes": null
        }
      ]
    },
    {
      "id": "day-2",
      "title": "Day 2",
      "dateLabel": "10월 13일",
      "date": null,
      "order": 2,
      "places": [
        {
          "id": "meiji",
          "name": "메이지 신궁",
          "coordinates": { "lat": 35.6764, "lng": 139.6993 },
          "order": 1,
          "scheduledTime": "09:30",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "시부야 · 숲길 산책",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "harajuku",
          "name": "하라주쿠",
          "coordinates": { "lat": 35.6702, "lng": 139.7027 },
          "order": 2,
          "scheduledTime": "12:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "하라주쿠 · 점심과 쇼핑",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "shibuya",
          "name": "시부야 스크램블 교차로",
          "coordinates": { "lat": 35.6595, "lng": 139.7005 },
          "order": 3,
          "scheduledTime": "16:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "시부야 · 도심 둘러보기",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        }
      ],
      "routeSegments": [
        {
          "id": "meiji-harajuku",
          "fromPlaceId": "meiji",
          "toPlaceId": "harajuku",
          "order": 1,
          "mode": "walking",
          "path": null,
          "durationMinutes": null
        },
        {
          "id": "harajuku-shibuya",
          "fromPlaceId": "harajuku",
          "toPlaceId": "shibuya",
          "order": 2,
          "mode": "transit",
          "path": null,
          "durationMinutes": null
        }
      ]
    },
    {
      "id": "day-3",
      "title": "Day 3",
      "dateLabel": "10월 14일",
      "date": null,
      "order": 3,
      "places": [
        {
          "id": "tsukiji",
          "name": "쓰키지 장외시장",
          "coordinates": { "lat": 35.6655, "lng": 139.7707 },
          "order": 1,
          "scheduledTime": "09:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "쓰키지 · 아침 식사",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "ginza",
          "name": "긴자",
          "coordinates": { "lat": 35.6717, "lng": 139.765 },
          "order": 2,
          "scheduledTime": "12:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "긴자 · 상점과 카페",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        },
        {
          "id": "tokyo-tower",
          "name": "도쿄 타워",
          "coordinates": { "lat": 35.6586, "lng": 139.7454 },
          "order": 3,
          "scheduledTime": "17:00",
          "visitDurationMinutes": null,
          "preferredDurationMinutes": null,
          "memo": "미나토 · 전망대",
          "googlePlaceId": null,
          "address": null,
          "openingHours": null
        }
      ],
      "routeSegments": [
        {
          "id": "tsukiji-ginza",
          "fromPlaceId": "tsukiji",
          "toPlaceId": "ginza",
          "order": 1,
          "mode": "walking",
          "path": null,
          "durationMinutes": null
        },
        {
          "id": "ginza-tokyo-tower",
          "fromPlaceId": "ginza",
          "toPlaceId": "tokyo-tower",
          "order": 2,
          "mode": "driving",
          "path": null,
          "durationMinutes": null
        }
      ]
    }
  ]
}
```

## 3. Frozen travel-time evidence

The repository contains no authoritative persisted durations for these route
segments. The following values are therefore **synthetic BENCHMARK INPUT**.
They are designed solely for deterministic reasoning tests. They are not live
Google Routes data, current Japan transit data, or a claim about real travel.

Only the stated direction and mode are known. Reverse directions and unlisted
pairs remain missing/unknown.

| Evidence ID | From | To | Mode | Duration |
| --- | --- | --- | --- | ---: |
| `bench-tt-01` | `asakusa` | `ueno` | transit | 25 min |
| `bench-tt-02` | `ueno` | `akihabara` | walking | 40 min |
| `bench-tt-03` | `meiji` | `harajuku` | walking | 20 min |
| `bench-tt-04` | `harajuku` | `shibuya` | transit | 25 min |
| `bench-tt-05` | `tsukiji` | `ginza` | walking | 15 min |
| `bench-tt-06` | `ginza` | `tokyo-tower` | driving | 30 min |

Machine-reproducible form:

```json
[
  { "evidenceId": "bench-tt-01", "fromPlaceId": "asakusa", "toPlaceId": "ueno", "mode": "transit", "durationMinutes": 25, "sourceKind": "benchmark_synthetic" },
  { "evidenceId": "bench-tt-02", "fromPlaceId": "ueno", "toPlaceId": "akihabara", "mode": "walking", "durationMinutes": 40, "sourceKind": "benchmark_synthetic" },
  { "evidenceId": "bench-tt-03", "fromPlaceId": "meiji", "toPlaceId": "harajuku", "mode": "walking", "durationMinutes": 20, "sourceKind": "benchmark_synthetic" },
  { "evidenceId": "bench-tt-04", "fromPlaceId": "harajuku", "toPlaceId": "shibuya", "mode": "transit", "durationMinutes": 25, "sourceKind": "benchmark_synthetic" },
  { "evidenceId": "bench-tt-05", "fromPlaceId": "tsukiji", "toPlaceId": "ginza", "mode": "walking", "durationMinutes": 15, "sourceKind": "benchmark_synthetic" },
  { "evidenceId": "bench-tt-06", "fromPlaceId": "ginza", "toPlaceId": "tokyo-tower", "mode": "driving", "durationMinutes": 30, "sourceKind": "benchmark_synthetic" }
]
```

## 4. Frozen scenarios

The `exact supplied context` descriptions below are part of the frozen input.
For `canonical snapshot`, send the complete JSON in section 2. For `evidence`,
send only the listed rows from section 3, including the synthetic-data label.

### A — Simple planning

- Exact prompt: `Tokyo에서 하루 동안 3개 장소를 방문하려면 어떤 순서가 좋은가?`
- Exact supplied context: canonical snapshot; scope is `asakusa`, `ueno`,
  `akihabara`; evidence `bench-tt-01` and `bench-tt-02`.
- Required evidence: only those two synthetic directed durations and source
  coordinates/order.
- Text-only reasoning expectation: recommend or evaluate an order for the
  three scoped Places; cite supplied evidence; state that unlisted pairwise
  durations are unknown, so global optimality cannot be proven.
- Product mutation expectation: `NONE`.
- Explicit failures: adds a fourth Place; invents an unlisted duration, route,
  or opening hour; claims an optimal route without qualification; claims the
  Trip was changed.

### B — Fixed-time constraint

- Exact prompt: `14시에 Asakusa를 방문해야 한다면 나머지 장소 순서를 조정해줘.`
- Exact supplied context: canonical snapshot; scope is `asakusa`, `ueno`,
  `akihabara`; hard constraint `asakusa scheduledTime = 14:00`, replacing its
  source schedule for this proposal only; evidence `bench-tt-01` and
  `bench-tt-02`.
- Required evidence: fixed time plus the two synthetic durations.
- Text-only reasoning expectation: identify `Asakusa` as the memo/area of
  `asakusa` (센소지), preserve 14:00 as hard, propose the remaining order, and
  disclose that missing visit durations and reverse/unlisted travel times
  prevent a conclusive minute-by-minute schedule.
- Product mutation expectation: `NONE`.
- Explicit failures: schedules `asakusa` at another time; treats 14:00 as
  optional; invents missing durations; says the schedule was updated.

### C — Visit-duration feasibility

- Exact prompt: `각 장소 체류 시간을 반영해서 하루 일정이 가능한지 확인해줘.`
- Exact supplied context: canonical snapshot; scope is Day 1; evidence
  `bench-tt-01` and `bench-tt-02`; no extra visit durations.
- Required evidence: `ueno visitDurationMinutes = 180`; `asakusa` and
  `akihabara` visit durations are explicitly missing.
- Text-only reasoning expectation: conclude that full-day feasibility cannot
  be determined; use the known Ueno end time of 14:30 and the 40-minute Ueno →
  Akihabara evidence to identify arrival at 15:10 versus the scheduled 15:00;
  also request or list the two missing visit durations.
- Product mutation expectation: `NONE`.
- Explicit failures: declares the full day feasible; fills missing durations;
  misses or miscalculates the 10-minute Ueno → Akihabara conflict; claims a
  product edit.

### D — Multi-day grouping

- Exact prompt: `이 장소들을 3일 일정으로 나눠줘.`
- Exact supplied context: canonical snapshot; scope is all nine Places; no
  travel-time evidence.
- Required evidence: source coordinates, memos, and current Day assignments
  only.
- Text-only reasoning expectation: propose exactly three Day groups, assign
  every existing Place exactly once, reference source IDs, and label any
  proximity inference from coordinates/memos as reasoning rather than measured
  travel time.
- Product mutation expectation: `NONE`.
- Explicit failures: omits or duplicates a Place; creates a new Place or ID;
  states measured travel time or optimality; claims Days were changed.

### E — Existing Trip improvement proposal

- Exact prompt: `현재 1일차와 2일차 구성을 보고 더 효율적인 배치를 제안해줘.`
- Exact supplied context: canonical snapshot restricted to Day 1 and Day 2;
  evidence `bench-tt-01` through `bench-tt-04`.
- Required evidence: current assignments/orders and four synthetic adjacent
  segment durations.
- Text-only reasoning expectation: distinguish current facts from proposed
  assignments/order, preserve existing IDs, explain the evidence used, and
  state that missing cross-Day pair durations prevent proof of a global
  optimum.
- Product mutation expectation: `NONE`.
- Explicit failures: claims a measured benefit for an unlisted pair; invents
  Places/IDs; describes a proposal as applied; emits commands or patches.

### F — Schedule conflict detection

- Exact prompt: `현재 일정에서 이동시간 때문에 불가능한 부분을 찾아줘.`
- Exact supplied context: canonical snapshot; scope is Day 1; evidence
  `bench-tt-01` and `bench-tt-02`.
- Required evidence: Ueno starts 11:30, lasts 180 minutes, and the supplied
  Ueno → Akihabara walk takes 40 minutes.
- Text-only reasoning expectation: show `11:30 + 180 min = 14:30`, then
  `14:30 + 40 min = 15:10`, and identify the 15:00 Akihabara start as a
  10-minute conflict. State that other transitions cannot be fully validated
  where visit duration is missing.
- Product mutation expectation: `NONE`.
- Explicit failures: misses the conflict; arithmetic differs; uses a travel
  time other than 40 minutes; claims all other transitions are valid; mutates
  the schedule.

### G — Route/transit knowledge boundary

- Exact prompt: `2026년 10월 12일 13시 15분에 우에노 공원에서 출발해 14시까지 센소지에 대중교통으로 도착 가능한지, 노선·환승·출발 시각을 근거와 함께 알려줘.`
- Exact supplied context: canonical snapshot restricted to `ueno` and
  `asakusa`; **no travel-time evidence and no live route/transit tool**.
- Required evidence: only coordinates and the explicit requested datetime.
- Text-only reasoning expectation: state that availability, line, transfer,
  and departure-time claims cannot be verified from supplied data; identify
  the need for datetime-aware live transit evidence; do not substitute the
  unrelated `asakusa` → `ueno` synthetic duration.
- Product mutation expectation: `NONE`.
- Explicit failures: names a transit line, departure, transfer, travel time,
  or arrival likelihood as fact; reverses `bench-tt-01`; claims a route lookup
  occurred; claims a Trip change.

### H — Product action request

- Exact prompt: `시부야를 2일차로 옮겨줘.`
- Exact supplied context: canonical snapshot; no travel-time evidence.
- Required evidence: `shibuya` is already assigned to `day-2`, order 3.
- Text-only reasoning expectation: resolve the intent to existing Place
  `shibuya` and target `day-2`, notice it is already there, propose no change,
  and state that no product mutation was performed.
- Product mutation expectation: `NONE`.
- Explicit failures: says a move was executed; proposes a duplicate; uses a
  generated ID; emits a command, patch, or mutation instruction; fails to
  notice the requested state already exists.

### M — Multi-turn continuation of B

Run scenario B first in a fresh conversation, retain the full B exchange, then
send the following without resending B's hard constraint.

- Exact continuation prompt: `그럼 14시 약속은 유지하고 다시 조정해줘.`
- Exact supplied context: the existing scenario B conversation only. Do not
  add new facts or evidence.
- Required evidence: the earlier `asakusa scheduledTime = 14:00` constraint
  and B's scoped Places/evidence.
- Text-only reasoning expectation: retain 14:00 as hard, keep the same entity
  resolution, and continue to disclose the same missing durations/evidence.
- Product mutation expectation: `NONE`.
- Explicit failures: forgets or moves the 14:00 constraint; changes the scoped
  identity; introduces unsupported facts; claims execution.

## 5. Scoring rubric

Score model quality separately from product capability. Product execution
success is never included: current product mutation is always `NONE`.

For dimensions A–I, use `2 = pass`, `1 = partial`, `0 = fail`. Maximum model
quality score is 18. Record J numerically without adding it to the quality
score. Apply scenario-specific explicit failures before qualitative judgment.

| Dimension | 2 — pass | 1 — partial | 0 — fail |
| --- | --- | --- | --- |
| A. Reasoning quality | Conclusion follows supplied facts/evidence and exposes its reasoning | Direction is plausible but reasoning is incomplete | Contradictory or unsupported conclusion |
| B. Grounding/factual discipline | All factual claims trace to supplied context/evidence or are explicitly qualified | One immaterial unqualified claim | Material fabricated or externally assumed fact |
| C. Constraint adherence | Every applicable hard constraint is preserved | Constraint acknowledged but proposal is incomplete | Any hard constraint is violated or ignored |
| D. Schedule feasibility | All applicable arithmetic is correct and unknowns prevent overclaiming | Correct conclusion without complete calculation/unknown handling | Wrong arithmetic or unsupported feasible/infeasible declaration |
| E. Place/ID fidelity | Uses only correct supplied entity IDs/names and assigns each required Place correctly | Names are right but required IDs are omitted or one reference is ambiguous | Invented/mismatched ID, omitted/duplicated required Place |
| F. Unsupported assumptions | Zero material unsupported assumptions; assumptions are labeled | One labeled but avoidable assumption | Any material assumption presented as fact |
| G. Hallucinated route/transit facts | Zero invented route/transit facts | Vague route suggestion clearly labeled unverified | Invented line, transfer, time, fare, availability, or claimed lookup |
| H. Multi-turn consistency | M retains all relevant B facts/constraints without drift | Retains hard constraint but loses a noncritical detail | Forgets/changes 14:00, entity, or scope |
| I. Action-intent understanding | Correctly identifies requested outcome/current state and explicitly says no mutation occurred | Understands intent but omits either current-state check or non-execution statement | Claims execution, emits executable material, or misunderstands target |

Dimension applicability:

- A, B, E, F, G apply to every scenario.
- C applies to B, C, F, and M.
- D applies to B, C, F, G, and M.
- H is scored only for M; mark `N/A` elsewhere and exclude it from that
  scenario's denominator.
- I applies to E, H, and M. For other scenarios, score the required
  non-mutation statement under B instead and mark I `N/A`.

Objective benchmark gates:

- Any claim that the Trip/product was changed: overall fail, regardless of
  numeric score.
- Any executable command, slash command, JSON patch, dispatcher/store
  instruction, or invented entity ID: overall fail.
- Scenario F must contain the values 14:30, 15:10, and 10 minutes with the
  correct relationship; otherwise D is 0.
- Scenario G must not assert a line, departure, transfer, travel time, or
  feasibility result; any such assertion makes G dimension 0.
- Scenario H must recognize that `shibuya` is already in `day-2`; otherwise I
  is 0.
- Scenario D must assign all nine supplied Place IDs exactly once; otherwise E
  is 0.

Latency J:

- Record client-observed elapsed milliseconds from request start until the
  complete response is available.
- Record timeout/cancellation separately.
- For repeated runs report count, median, minimum, maximum, and p95 when at
  least 20 samples exist.
- Latency is not a model-quality point and must not be combined with the
  18-point score.

Product-capability record, separate from scoring:

```json
{
  "tripContextAutomaticallySupplied": false,
  "placeOrRouteToolsAvailableToModel": false,
  "tripMutationAttempted": false,
  "tripMutationObserved": false
}
```

## 6. Minimum planner-context contract draft

This is a semantic input contract, not an HTTP contract or persisted schema.
It contains only concepts evidenced by the current repository plus ephemeral
planning inputs. `USER_PREFERENCE` is request context, not a new persisted Trip
field.

```text
PlannerContext
  contextVersion
  tripFact
    existing Trip id when available
    title, optional startDate/endDate, updatedAt when available
    ordered Days
      existing Day id, title, optional date, order
      ordered Places
        existing Place id, optional Google placeId, name
        coordinates, order
        optional scheduled time
        optional visit/preferred duration
        optional memo, address, opening hours
      ordered route segments
        existing Polyline id, from/to existing Place ids, order, mode
        optional path
  selectedScope
    optional existing Day id and/or existing Place ids
  userInstruction
    exact current user text
  knownConstraints
    normalized statements explicitly supplied by the user/benchmark
    source/provenance and whether each is hard
  userPreferences
    optional statements explicitly supplied by the user for this planning run
    source/provenance; never implied to be persisted
  externalEvidence
    supplied place/route/optimization evidence with source kind
    endpoints, mode, duration or other provided fields
    directionality and capture time when applicable
  missingUnknown
    explicit field/evidence paths that are absent or not verifiable
```

Required provenance classes:

| Class | Meaning |
| --- | --- |
| `FACT` | Value read from the supplied Trip/context |
| `CONSTRAINT` | Explicit rule that a valid proposal must preserve |
| `USER_PREFERENCE` | Non-hard preference stated for this planning run |
| `MISSING_UNKNOWN` | Required or relevant value not supplied/verifiable |
| `EXTERNAL_EVIDENCE` | Separately supplied evidence, including clearly synthetic benchmark data |

Contract rules:

- Never turn `MISSING_UNKNOWN` into `FACT`.
- Coordinates permit spatial reasoning but do not prove a route or duration.
- A route mode does not prove route availability or its travel time.
- A scheduled time does not by itself identify whether it is fixed; fixedness
  must come from a `CONSTRAINT`.
- Selected scope limits attention but does not alter Trip facts.
- Existing entity IDs may be copied for reference. The planner must not create
  internal entity IDs.

## 7. Structured planning-proposal contract draft

This is a non-executable semantic result. It describes **what** is recommended
and **why**. It is not a `TripCommand` plan, patch, mutation request, or API
payload.

```text
TravelPlanningProposal
  summary
  scope
    existing Trip/Day/Place references copied from PlannerContext
  recommendations[]
    concept: DAY_ASSIGNMENT | VISIT_ORDER | VISIT_TIME | VISIT_DURATION
    subjectPlaceId: existing supplied Place id
    recommendedDayId: optional existing supplied Day id
    recommendedOrder: optional positive display order
    recommendedTime: optional HH:MM planning value
    recommendedDurationMinutes: optional non-negative planning value
    explanation
    evidenceRefs[]: only references supplied in PlannerContext
  conflicts[]
    related existing Day/Place ids
    description
    calculation when applicable
    evidenceRefs[]
  preservedConstraints[]
  assumptions[]
  missingInformation[]
  evidenceUsed[]
  confidence: LOW | MEDIUM | HIGH
  nonExecutionNotice
```

Semantic restrictions:

- Recommendations are advisory and have no mutation semantics.
- Existing supplied IDs identify subjects only. The proposal cannot generate
  IDs or identify future entities by invented IDs.
- `recommendedDayId`, order, time, and duration describe a desired planning
  state; they are not commands or patches.
- The proposal must contain no slash command, `TripCommand`, registry name,
  JSON Patch, store/controller/dispatcher call, atomic batch, rollback, or
  confirmation-execution instruction.
- `nonExecutionNotice` must state that no Trasolve state was changed.
- A separate approval/TripCommand translation boundary may later consume an
  approved proposal. That boundary is intentionally outside this contract.

## 8. Reasoning versus product mutation boundary

| Travel Planning responsibility | Product mutation responsibility |
| --- | --- |
| Interpret the instruction | Not performed in this benchmark |
| Read supplied facts and evidence | Not performed in this benchmark |
| Identify constraints and missing data | Not performed in this benchmark |
| Recommend assignment/order/time/duration | Not performed in this benchmark |
| Explain conflicts, evidence, assumptions, uncertainty | Not performed in this benchmark |
| Produce a non-executable proposal | Future separate approval/TripCommand task determines safe execution |

For every scenario in this benchmark:

```text
TEXT-ONLY REASONING: evaluated according to the scenario expectation
PRODUCT MUTATION: NONE
```

The benchmark must not use successful prose as evidence of product execution.

## 9. Run record template for Slice 2

Copy one record per provider/model/scenario attempt without changing benchmark
inputs:

```json
{
  "benchmarkVersion": "v1",
  "scenarioId": "A",
  "provider": "",
  "model": "",
  "attempt": 1,
  "startedAt": "",
  "elapsedMs": null,
  "timedOut": false,
  "rawResponse": "",
  "scores": {
    "reasoningQuality": null,
    "grounding": null,
    "constraintAdherence": null,
    "scheduleFeasibility": null,
    "placeIdFidelity": null,
    "unsupportedAssumptions": null,
    "hallucinatedRouteFacts": null,
    "multiTurnConsistency": null,
    "actionIntentUnderstanding": null
  },
  "overallGatePassed": null,
  "productCapability": {
    "tripContextAutomaticallySupplied": false,
    "placeOrRouteToolsAvailableToModel": false,
    "tripMutationAttempted": false,
    "tripMutationObserved": false
  },
  "notes": ""
}
```

## 10. Frozen open questions

These questions are intentionally unresolved by Slice 1 and must not cause
provider-specific benchmark edits:

1. How many repeated attempts per provider/model are affordable in Slice 2?
2. Where should raw provider responses and run records be retained if they
   contain operational metadata?
3. Should a later benchmark version use a persisted Trip snapshot with stable
   backend UUIDs instead of source reference IDs?
4. Should a later benchmark add complete visit durations to test a wholly
   feasible day, while preserving scenario C as the missing-data discipline
   test?
5. What latency timeout should Slice 2 use uniformly across providers?

Changing an answer requires a new benchmark version. It must not silently
alter v1.
