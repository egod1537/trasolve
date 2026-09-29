# AI Chat 멀티세션 E2E 검증 기록

## Purpose

이 문서는 서로 다른 세 개의 AI Chat에서 거의 동시에 요청할 때 일부 응답이
누락됐던 기존 보고를 W4 기준으로 재검증한 결과를 기록한다. `main` 기준 E2E가 먼저
PASS한 뒤, PR #10으로 추가된 conversation/session/context 계층과 현재 production AI
Chat을 구성하는 frontend → backend → provider 연결이 W4에서도 동일한 acceptance
criteria를 유지하는지 확인했다.

Production UI의 `/api/chat` 경로는 `ConversationService`를 직접 호출하지 않는다.
따라서 이 검증은 해당 경로를 강제로 변경하지 않고, frontend가 소유한 thread별
history와 기존 `ChatService` provider 경로를 그대로 사용했다.

## Environment

- Baseline: `origin/w4` at `c4e2ef1`
- Revalidation branch: `fix-ai-chat-multisession-e2e-w4`
- UI: `/testbed/ai-chat`
- Provider: 실제 OpenWebUI
- Model: `qwen3.5:2b`
- Request path: 실제 frontend → `/api/chat` → `ChatService` → OpenWebUI 요청
- Mock 또는 fake provider 응답을 성공 증거로 사용하지 않음
- API key, provider endpoint 및 기타 secret은 기록하지 않음

## W4 Revalidation

기존 `main` 검증과 같은 browser → API → provider → original thread render 흐름을
W4에서 다시 실행했다. 세 개 이상의 동시 요청, 완료 순서 역전, thread별 multi-turn
history, 요청 중 thread 전환, cancel/delete/failure/timeout isolation을 모두 실제
provider request로 확인했다. W4에서도 production code 변경은 필요하지 않았다.

## Reproduction Result

기존 3-chat missing-response issue는 W4에서도 재현되지 않았다. 서로 다른 세
thread의 요청은 385ms 이내에 시작됐고 모두 HTTP 200으로 완료됐다. 완료 순서는
A → C → B였지만 모든 response가 요청을 시작한 original thread에 저장됐다. 정상 요청에서
`REQUEST_DROPPED`는 0건이었다.

## Acceptance Matrix

| 항목                              | 결과 | 실제 검증 조건과 관찰 결과                                                                                                                                            |
| --------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 concurrent chats                | PASS | 실제 `qwen3.5:2b` 요청 세 개를 385ms 이내에 시작했다. 3/3 HTTP 200이었고 A(2.409s) → C(2.628s) → B(3.271s) 순서로 완료됐다.                                           |
| Reversed completion order         | PASS | A `/delay 5000`, B `/delay 1000`, C `/delay 3000`으로 실행했다. B(11.949s) → C(20.066s) → A(22.200s) 순서로 완료됐고 모두 original thread에 append됐다.               |
| History isolation                 | PASS | APPLE, BANANA, CHERRY thread의 두 번째 request body에는 해당 thread의 user/assistant history만 포함됐고 다른 코드워드는 포함되지 않았다.                              |
| Multi-turn context                | PASS | 실제 provider가 두 번째 turn에서 각 thread의 코드워드를 `APPLE`, `BANANA`, `CHERRY`로 정확히 응답했다.                                                                |
| Thread switching                  | PASS | reversed-order 요청 중 A/B/C를 반복 전환했다. 전환으로 abort된 요청이나 현재 선택 thread에 잘못 append된 response가 없었다.                                           |
| Cancel isolation                  | PASS | provider fetch 시작 후 A만 0.402s에 explicit cancel했다. B/C는 각각 3.363s와 19.622s에 HTTP 200으로 완료됐다.                                                         |
| Delete isolation                  | PASS | A를 delay 중 0.390s에 삭제했다. B/C는 7.286s와 17.015s에 완료됐으며 삭제된 thread는 부활하지 않았다.                                                                  |
| Failure isolation                 | PASS | A만 존재하지 않는 model로 보내 0.913s 후 HTTP 502를 받았다. B/C의 `qwen3.5:2b` 요청은 9.539s와 18.419s에 HTTP 200이었다.                                              |
| Timeout isolation                 | PASS | A는 `qwen3.5:4b`, B/C는 `qwen3.5:2b`로 동시에 전송했다. A만 120.073s 후 HTTP 502였고 B/C는 9.154s와 17.199s에 정상 완료됐다.                                          |
| Request lifecycle                 | PASS | 정상 요청은 `REQUEST_CREATED`부터 `ASSISTANT_MESSAGE_APPENDED`, `REQUEST_FINISHED`까지 동일 requestId/threadId를 유지했다. 정상 요청의 `REQUEST_DROPPED`는 0건이었다. |
| Context/history payload isolation | PASS | 각 두 번째 payload가 `[자기 user, 자기 assistant, follow-up user]`로 구성됐고 다른 thread message가 섞이지 않았다.                                                    |

## Isolation Cases

### Explicit cancel

A, B, C의 실제 provider fetch를 시작한 뒤 A만 cancel했다. A browser request와
lifecycle만 0.402s에 `explicit-cancel`로 중단됐고 A response는 UI에 append되지
않았다. B와 C는 각각 3.363s와 19.622s 후 HTTP 200으로 완료됐다.

### Thread delete

A에는 5초 debug delay를 적용하고 B/C actual provider request와 동시에 실행했다. A를
삭제하자 A만 0.390s에 `REQUEST_ABORTED(reason=thread-deleted)`가 됐으며 A provider
fetch는 시작되지 않았다. B와 C는 각각 7.286s와 17.015s 후 HTTP 200으로 완료됐고
최종 thread 수는 2로 유지됐다.

### Invalid model

Testbed의 per-request model 선택을 이용해 A에만 존재하지 않는 model을 지정했다. A는
0.913s 후 HTTP 502를 받았고 error는 A thread에만 표시됐다. 동시에 실행한 B/C의
`qwen3.5:2b` 요청은 각각 9.539s와 18.419s 후 HTTP 200으로 완료됐다.

### Provider timeout

A의 `qwen3.5:4b` 요청은 120.073s 후 HTTP 502로 종료됐다. 동시에 실행한
`qwen3.5:2b` 요청은 B가 9.154s, C가 17.199s에 HTTP 200으로 완료됐다. A timeout은
B/C의 request lifecycle, response append 또는 thread state에 영향을 주지 않았다.

## Architecture Findings

- Frontend request ownership: `useThreadRequests`가 `threadId`별 request handle,
  requestId와 `AbortController`를 소유한다. 한 thread에는 한 pending request만
  존재하지만 서로 다른 thread 요청은 병렬로 실행된다.
- History ownership: `MapAiPanel`이 thread별 message snapshot을 유지하고 submit 시점의
  해당 snapshot만 `/api/chat` payload로 만든다.
- Abort ownership: explicit cancel과 thread delete는 대상 thread의 controller만
  abort한다. thread 전환은 request를 abort하지 않는다.
- Response ownership: response는 현재 selected thread가 아니라 submit 시 캡처한
  original `threadId`에 append된다.
- Deleted thread protection: delete 시 request를 abort하고 message snapshot과 thread
  ID를 제거한다. 늦은 response가 삭제된 thread를 다시 만들지 못한다.
- Backend/provider concurrency: `/api/chat`, `ChatService`, OpenWebUI provider/client는
  request-local payload와 response를 사용하며 response 귀속에 영향을 주는 global
  mutable request state가 없다.
- `ConversationService` serialization: 작업 queue는 conversation ID별로 분리된다. 같은
  conversation의 작업만 직렬화하고 서로 다른 conversation 작업은 병렬 실행된다.

## Conclusion

- W4 `c4e2ef1`에서 원래 3-chat missing-response defect는 재현되지 않았다.
- frontend, backend 또는 provider 연결 코드의 multi-session defect는 확인되지 않았다.
- production 구현 변경은 필요하지 않다.
- 현재 architecture는 병렬 요청, original thread 귀속, history/context isolation,
  switching, cancel/delete/failure/timeout isolation acceptance criteria를 만족한다.
- `qwen3.5:4b`의 약 120초 timeout은 provider/runtime 문제이며 AI Chat multi-session
  state ownership defect가 아니다.

## Validation

| 검증                     | 결과 |
| ------------------------ | ---- |
| Frontend typecheck       | PASS |
| Backend typecheck        | PASS |
| Full workspace typecheck | PASS |
| Lint                     | PASS |
| Format check             | PASS |
| Frontend build           | PASS |
| Backend build            | PASS |
| `git diff --check`       | PASS |

이 검증을 위해 production code, 테스트 framework, fixture, mock 또는 test-only 분기를
추가하지 않았다.
