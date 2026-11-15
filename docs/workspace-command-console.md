# Workspace command console

Ctrl+K (Command+K on macOS) opens the editable map workspace console. Input is a
command directly, without a `>` or `/` prefix. Quote arguments containing spaces.
Names resolve by exact ID or unique normalized name; ambiguous matches are errors.
Day ordinals and result indexes start at 1. `help` lists the registry and available
handlers; `help "place"` limits the list to a command family.

## Command reference

| Area                  | Commands and examples                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search                | `search "서울역"`, `search "카페" --near "서울역"`, `find "메모 내용"`                                                                                        |
| AI                    | `ai "2일차 장소를 추천해줘"`, `ai new`, `ai stop`                                                                                                             |
| Trips                 | `trip list`, `trip new "도쿄 여행"`, `trip open "도쿄 여행"`, `trip rename "새 이름"`, `trip delete`                                                          |
| Days                  | `day list`, `day add "Day 2"`, `day select 2`, `day rename 2 "둘째 날"`, `day move 2 1`, `day show all`, `day hide 2`, `day color 2 blue`                     |
| Add a place           | `place add --result 1 --day 2`, `place add "exact unique query" --day 2`, `place add --placeId "provider ID" --day 2`                                         |
| Place details         | `place inspect "provider ID"`, `place select "서울역"`, `place rename "서울역" "출발역"`                                                                      |
| Edit a place          | `place move "서울역" --day 2 --order 1`, `place time "서울역" 10:00 11:00`, `place memo "서울역" "메모"`, `place color "서울역" red`, `place remove "서울역"` |
| Routes                | `route search "서울역" "강남역" --mode transit`, `route detail 1`, `route mode walking --day 2`                                                               |
| Optimization          | `optimize --day 2` opens existing settings; `optimize --day 2 --start 09:00 --end 20:00 --mode transit` computes a preview; `optimize apply` applies it       |
| Map                   | `map fit`, `map fit --day 2`, `map goto "서울역"`, `map zoom 14`, `tool pan`, `tool distance`, `tool area`                                                    |
| Files and preferences | `capture`, `export pdf`, `export kml`, `export kmz`, `import --day 2`, `settings`                                                                             |
| History               | `undo`, `redo`                                                                                                                                                |

`--key=value`, quoted values and escaped quotes are supported. `--` ends option
parsing. Unknown options, duplicate arguments and unfinished quotes are rejected.
`place time 10:00 11:00`, `place memo "메모"`, `place remove` and `place move --day 2`
use the selected saved place. Optional `--day` uses the selected Day. Visit times
follow the existing same-day, 10-minute schedule resolution. Colors accept the
listed palette names or a six-digit hex value. Route modes are `straight`,
`walking`, `transit`, `driving`; provider route search and optimization exclude
`straight`. Search result selection always refers to the most recent search.

## Assistance and output

Tab accepts the highlighted completion; arrows change the highlight. Completion
offers command names, options, saved place names, Day ordinals, colors and enum
values at the active argument. Ctrl+Up/Down recalls up to 30 submitted commands.
The syntax line remains visible while entering arguments. Enter executes; Escape
closes the dialog without cancelling a request. Cancel explicitly aborts a request.

The fixed-height dialog keeps its input and footer outside the scrollable results.
The last 20 executions show running/completed/cancelled/error status, selectable
search or route results, AI replies and expandable structured data. Route result
buttons retain their originating batch (up to 10 recent batches). Public provider
requests and AI use existing authenticated, metered clients; no SDK or backend is
bypassed. UI handoffs close the console and open the existing destination dialog.
Deleting a trip retains its existing confirmation. Edits are local controller
operations and continue through existing autosave; `saved: false` is not a claim
of server persistence. Trip switches first flush and confirm the current save.

## Shared execution and AI

`shared/schemas/workspaceCommand.ts` is the common command catalog and strict
argument validator. Text parsing and AI JSON proposals both enter the same scoped
runtime. Edit handlers invoke TripEditController/TripCommand, preserving undo,
immutable snapshots, autosave and recovery. UI/read handlers use the existing
feature contracts. Only one command executes at a time. Aborting or unmounting an
owning trip session cancels its request; stale responses cannot mutate another trip.

Both chat and `ai` receive the available command catalog, split within message
limits. A single operation proposal is validated JSON:

```json
{
  "kind": "workspace_command",
  "command": { "name": "day rename", "args": { "day": 2, "title": "둘째 날" } }
}
```

The user applies a proposal through the same registry. Trip identity and editable
state are captured; changes invalidate a stale proposal, while save timestamps do
not. This is a reviewed command proposal workflow, not an autonomous server tool
loop. Main chat retains the existing reviewed TripCommandPlan multi-step flow;
console AI proposes one operation per answer. Console conversation and execution
history are session-local. `ai new` clears that conversation; `ai stop` cancels only
an active console AI request. Existing main-chat thread controls remain separate.
