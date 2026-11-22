# 국내 여행 AI 일괄 실행

Trasolve 지도 화면에서 각 케이스를 새 Chrome 탭으로 실행한다. 탭은 격리 프로필의 로그인 세션을 공유한다. 여행별 단일 채팅에서 기존 사용자 메시지가 없는지 실행 전에 확인한다. Preview를 검증하고 같은 여행을 다시 읽어 ETag와 Trip이 같은지 확인한다.

실행 전에 승인된 Provider와 Places 경로가 연결된 loopback 개발 서버를 준비한다. 개발 서버의 API와 Provider가 합성이라면 `synthetic`, 실제 모델을 호출한다면 `real`을 기록한다. 보고서의 Provider 모드는 실행자가 지정한 값이므로 실제 Provider 수신 기록과 함께 보관한다. 별도 Chrome 프로필에서 개발 서버에 로그인하고 사용할 국내 Trip을 직접 확인한다. Chrome의 원격 디버깅은 loopback에서만 연다.

```sh
npm run build -w @trasolve/shared
node infra/ai-e2e/run.mjs \
  --manifest .local/domestic-cases.json \
  --origin http://127.0.0.1:5173 \
  --cdp http://127.0.0.1:9222 \
  --output .local/domestic-results.json
```

입력 파일의 예시는 기존 Task05 Manifest에서 한국어 프롬프트를 가져온다. 사용자의 소유 Trip ID와 올바른 초기 상태로 바꿔 실행한다. 각 행에 `prompt`를 직접 쓰는 것도 가능하다. `sourceManifest`는 입력 JSON 파일 기준의 상대 경로이며 원본 파일을 변경하지 않는다.

```json
{
  "providerMode": "synthetic",
  "sourceManifest": "../../trasolve-evidence/task05-command-coverage-20261117/execution-manifest.json",
  "cases": [
    {
      "id": "rename-seoul",
      "sourceCase": "T05-LIVE-S01",
      "tripId": "seoul-trip",
      "expect": {
        "outcome": "preview",
        "before": { "/title": "서울 여행" },
        "beforeText": "서울 여행",
        "afterText": "서울 봄 여행"
      }
    }
  ]
}
```

- `preview`에서는 `beforeText`와 `afterText`로 화면에 보이는 두 스냅샷을 검사한다. 제품에 구조화된 Preview 진단이 있는 환경에서는 `diffOps`로 연산의 종류와 개수를, `after`로 변경 후 값을 검사할 수 있다. `diffOps`를 요청했을 때 구조화된 진단이 없으면 실패로 기록한다. `before`는 canonical GET의 초기값을 JSON Pointer로 검사한다. 초기값이 다르면 Chat을 보내기 전에 케이스가 실패한다.
- `plan_error`는 제품이 제공하는 `code`나 화면 문구의 `errorIncludes`를 사용한다. 문구 비교는 실행 중인 화면 언어에 맞춘다. `chat_error`는 SSE 또는 HTTP `code`, 일반 텍스트 `response`는 `responseIncludes`가 필요하다. `tool`로 응답의 구조화된 Tool 이름을, `placesCalls`로 Places 호출 건수를 검사할 수 있다.
- 결과에는 Chat 요청 ID, 요청에서 제공한 Tool, 응답 모델, 검증된 Tool 호출 인수, Places HTTP 상태와 소요 시간, SSE 이벤트, UI의 Plan 오류 및 진단, 실행 전후 canonical 상태와 확보한 Preview가 포함된다. `responseMs`는 브라우저가 관찰한 Chat HTTP 전체 시간이고 `elapsedMs`는 케이스 전체 시간이다.
- 실행기는 Apply를 누르지 않으며 해당 탭의 Trip 쓰기 요청을 브라우저에서 차단한다. 저장·재시작·커밋 후 연결 중단 시나리오는 [기존 수동 시나리오](scenarios.md)의 절차를 사용한다.
- 실패 결과를 저장하고 다음 케이스를 실행한다. 하나라도 실패하면 종료 코드는 1이다. 보고서는 새 파일로만 생성되고 원문 프롬프트·응답·Trip을 담으므로 로컬에 보관한다.
