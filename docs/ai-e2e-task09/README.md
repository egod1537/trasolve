# Task09 국내 AI E2E 실행·검토 패킷

작성일: 2026-11-01 KST. 상태: **문서 준비 / 독립 검토 대기 / GPT E2E NOT RUN**.

## 기준과 범위

- 격리된 배정 child: `w9-domestic-e2e-testset`, 동일 이름 branch. 시작 시 clean.
- HEAD 및 로컬 `origin/w9`: `2d0096184b2efa67c0f546521da9c9110ea50c14`.
- child는 이미 이 기준으로 배치되어 있어 추가 중첩 worktree를 만들지 않았다.
- **GitHub DNS 실패라는 dispatch 전제에 따라 로컬 origin/w9만 사용했다. live remote와 일치하는지 검증하지 않았다.** fetch, reset, merge, commit, push, PR, 배포 없음.
- 후속 코디네이터 메시지 `msg_63d87f426729` (2026-11-01 04:27:11 UTC)는 sandbox 밖 HTTPS 200 및 read-only ls-remote로 원격 w9가 같은 SHA임을 확인했다고 보고했다. 이는 **코디네이터가 보고한 후속 remote 확인**이며 이 worker의 직접 확인과 구분한다. 초기 local-only provenance는 그대로 유지하고 이 worker는 fetch를 반복하지 않았다.
- 읽기 전용 참조: `/Users/harryrha/orca/workspaces/trasolve/feat-ai-tripcommand-generation-execution` (T3), `/Users/harryrha/orca/workspaces/trasolve/w9-ai-e2e-recovery` (진행 중 parser/context/UI 계약). 두 참조를 수정하지 않았다.
- `AGENTS.md`, `.gitattributes`, `.editorconfig`, Prettier LF 설정을 읽었다. 자동 테스트·fixture·mock·실행 스크립트·provider 호출을 추가하거나 실행하지 않았다.

## 읽는 순서

1. [시나리오와 수동 실행 절차](scenarios.md): 초기 상태, ID 확보, strict Plan, 상태 차이, 합격 기준.
2. [기존 T3 증거 보존본](historical-evidence.md): 원본 파일별 SHA256, 전체 원문, 케이스별 결과. 새 실행 결과와 합산하지 않는다.
3. [양성준 검토 요청문](review-yang-seongjun.md): 복사 가능한 검토 패킷. 외부 전송하지 않았다.

## 요구사항 추적과 미확인 사항

| 요구 | 문서 위치 / 판정 |
| --- | --- |
| 국내 자연어 + 명시적 초기 상태 + canonical ID | scenarios 초기 상태 및 각 행 |
| 13개 단일 명령 + 복합 명령 | S01–S13, C1–C3 |
| 모호성·취소·stale·충돌·부분 실패/atomicity | N01–N10 |
| strict Plan·예상 diff·성공/실패·증거 | 공통 계약, 각 행, 증거 카드 |
| 기존 케이스·PASS/FAIL 증거 보존 | historical-evidence 전체 원문 및 SHA256 |
| GPT 제품 모델 및 provider 확정 | **리드 확인 전 전체 GPT 실행 BLOCKED**; 에이전트 자신의 모델은 제품 모델 증거가 아님 |
| 원본 Task09 및 기존 23-case draft 완전 대조 | **원문 locator 미확인 provenance note**. T3 runner 및 JSON에서 직접 확인한 것은 S01–S13/C1–C3의 16개 ID이며 23개 원문 목록은 확인하지 못함. 나머지 7개를 임의로 기존 케이스로 명명하지 않음 |
| 양성준 공유 | 복사문 준비만 완료; 접근 가능한 identity/승인된 전송 수단 미확인으로 전송하지 않음 |

원본 Task09는 배정 요청에서 참조되지만 URL/경로가 없었다. 두 참조의 문서·runner·evidence와 로컬 문서 검색에서 원문을 찾지 못했으며 연결 Notion의 `Task09`, `국내 AI` 검색도 관련 페이지를 반환하지 않았다. 코디네이터에게 정확한 locator를 요청했다. 따라서 이 문서는 dispatch의 명시 요구를 구현한 실행 후보이며 **원문 요구 전체 충족 또는 기존 23개 전체 보존 확인을 선언하지 않는다**. 확보되는 원문/추가 케이스는 삭제·치환 없이 추가 매핑해야 한다.

코디네이터 ask 회신은 제공된 사용자 Task09 기준과 이번 directive를 작업 기준으로 사용하고, 23-case 원문을 발견했다고 주장하지 말며, locator 미확인은 provenance note로 남기고 완료하도록 지시했다. 이를 반영해 주요 26개(S 13 + C 3 + N 10) 및 독립 변형 C1b/C3b 2개를 작성했다. 양성준 실제 전달은 **HUMAN_REQUIRED**로 유지한다. 원문 locator를 기다리는 작업은 남아 있지 않으며 향후 확보 시 보완할 사항이다.

## 지금 가능한 것과 의존성

| 작업 / 시나리오 | 현재 실행 가능성 |
| --- | --- |
| 문서·strict schema·13개 operation·기존 증거 독립 검토 | **지금 가능**, provider 불필요 |
| 수동 Plan/engine-only 검토 | parser/context가 있는 recovery 참조 소스의 정적 검토만 수행. 새 child에는 미커밋 recovery 구현이 없으므로 동일 기능이 있다고 가정하지 않음 |
| S01–S04, S06–S10, S13, C2 및 안전성 N01–N10 | 자연어 GPT E2E는 provider/model 확정 + 검토된 recovery 구현 통합 + 실제 앱/저장소 필요 |
| S05, C1 및 검색 모호성 | 위 조건 + 실제 Places 서버 설정. 원시 좌표/가짜 장소로 대체 불가 |
| S11, S12 | coupled duration의 현 동작을 관측하는 것은 의존성 해소 후 가능; **다른 duration 불변이라는 제품 의미는 domain 지원 전 GAP** |
| C3 선택 지시 | recovery UI가 빈 selection을 전달하므로 **선택 문맥 연결 전 GAP**. 명시적 장소명 변형은 별도 C3b로만 기록 |
| PostgreSQL conflict/atomicity/재시작 내구성 | 실제 PostgreSQL 모드와 revision/두 세션 필요. local-file 결과를 PostgreSQL PASS로 승격 불가 |

Gemini, OpenWebUI 또는 local/random을 fallback으로 호출하지 않는다. 리드가 GPT의 정확한 제품 모델·provider·endpoint·설정 위치·실행 권한을 확정한 후 그 경로만 사용한다. GPT가 OpenWebUI를 경유한다는 별도 리드 확인이 없는 한 OpenWebUI를 선택하지 않는다. credential은 증거/문서에 넣지 않는다.

## 검증 기록

문서만 변경했으므로 앱 typecheck/build/lint나 localization sync는 이 작업의 검증으로 실행하지 않는다. 변경 문서의 UTF-8/LF/실제 CR byte, 변경 경로, JSON 예시의 구조, 13개 op 누락 및 `git diff --check`를 확인한다. 최종 결과는 review packet에 기록한다. 문서 작성 완료와 제품 E2E 승인, 원문 대조 완료는 각각 별개다.

초기 문서 검증: Markdown 4개 UTF-8 decode 성공 및 실제 CR=0, 표의 operations JSON 배열 16개 decode 성공, 13개 op 전체 포함, envelope JSON decode 성공, 역사 파일 6개 전체 원문과 SHA256 일치 확인. `git diff --check` exit 0이며 untracked 문서는 별도 byte 검사했다. 설치된 node_modules가 없어 앱 의존성을 설치하지 않았고 문서 검증은 Python 표준 라이브러리의 읽기 전용 검사로 수행했다.

최종 정적 검토에서는 operation 필드와 선행 result 참조를 확인하고, 실제 `reconcileDayRouteSegments`의 자동 route/layer/order 정합을 예상 diff에 포함했다. 이 검증은 JSON decode와 source 계약 대조이며 앱 parser 실행이나 실제 E2E 검증이 아니다. 독립 검토는 코디네이터가 별도로 진행해야 하며 이 문서는 자체 검토만 완료했다.

## Recovery 참조 snapshot 식별

진행 중 dirty Worktree이므로 HEAD만으로 구현을 식별하지 않는다. 다음은 문서 작성 시 읽은 파일의 SHA256이며 이후 통합/실행자는 달라진 파일을 재검토해야 한다. root는 위의 읽기 전용 recovery 경로다.

| 상대 경로 | SHA256 |
| --- | --- |
| `shared/schemas/tripCommandPlan.ts` | `4d1a62f3f307fa37ddbe628abb0dd9bd9b36195a326cf9bb12226657236476c8` |
| `frontend/src/features/map-workspace/ai-command/TripCommandPlanParser.ts` | `4a49e42cbd33fee9b4e804355956d6c1c654cda1db4fc2e41130fe940f0900ab` |
| `frontend/src/features/map-workspace/ai-command/TripCommandPlanContext.ts` | `2d7f28820cf0dcd724997de83a42bd304919cadaf6441596d88bb448a5cb8445` |
| `frontend/src/features/map-workspace/ai-command/TripCommandPlanExecutor.ts` | `31610e9f4c0af362b4ec89326e50ed205e1ccb9a8a5789de233e359c1ec1e6fe` |
| `frontend/src/features/map-workspace/ai-command/TripCommandPlanAdapter.ts` | `d5585c25f8f211280c26f30c1768507d46d8a4fb1bea5f93c76e1a8e91ddfff3` |
| `frontend/src/features/map-workspace/ui/TripAiRegion.tsx` | `4d0d2e2e3e3a5e9cfa2a31ce6a2548e245f449c0ae83550aa0575bb17d139aad` |
| `docs/wave-1-tripcommand-continuation.md` | `660f59981490b511525300b4bfede1ecbfb562820a8eae639d6b1f16718a9871` |
