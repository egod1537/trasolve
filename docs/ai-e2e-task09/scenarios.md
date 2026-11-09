# 국내 시나리오와 수동 실행 절차

모든 새 시나리오 상태: **NOT RUN / GPT_DEPENDENCY_GATED**. 아래 Plan은 기대값 문서이며 assistant 출력이나 실행 증거가 아니다. 기존 T3 ID와 연결하되 국내 케이스는 `KR-` 접두사로 구분한다.

## 실제 초기 상태와 ID 확보

각 행은 별도의 사용자 소유 disposable 여행에서 독립 실행한다. 직전 행의 변경 상태를 다음 행의 기준으로 재사용하지 않는다. 실제 UI에서 여행 `Task09 서울 국내 검토`를 만들고 실제 Places 조회로 서울 장소를 등록한다. 장소 검색 결과의 이름·주소·external place ID를 검토하고 UI 저장 후 canonical 조회/브라우저 reload로 다음 표를 확보한다. 가짜 SDK, mock response, fixture import, 임의 UUID 주입은 금지한다. 아래 기호는 **문서 자리표시자**이며 실제 응답으로 치환하기 전 제출할 JSON이 아니다.

| 기호 | 저장·재조회 후 확인할 값 |
| --- | --- |
| T, R, F | canonical trip ID, revision, production fingerprint/context의 정확한 문자열 |
| D1, D2 | `1일차`, `2일차`의 canonical day ID. D1: [P1, P2], D2: [P3] |
| D3 | S04만 `3일차`를 미리 추가. S02/C3에는 D3가 없어야 함 |
| P1 | D1 첫 장소 `경복궁`, 실제 반환 주소·좌표·external ID, 10:00, visit=60, preferred=60, memo 없음 |
| P2 | D1 두 번째 `국립민속박물관`, 실제 반환 상세, 12:00, visit=60, preferred=60, memo 없음 |
| P3 | D2 첫 `남산서울타워`, 실제 반환 상세, 10:00, visit=60, preferred=60, memo 없음 |
| L1 | D1의 P1→P2 연결, canonical polyline ID, mode=`straight`; layerItems는 [P1,L1,P2] |

기존 `shared/domain/tripRoutes.ts`는 이웃 장소 사이 segment를 자동 정합하므로 기본 상태에도 L1이 있다. 실제 저장·재조회한 polylines/layerItems/order를 기준으로 한다. 날짜·색·기타 필드는 실제 저장값을 before에 함께 보존하고 요청이 없는 한 불변을 검사한다. backend가 장소명을 다르게 반환하면 UI에서 위 표시명으로 바꾼 후 다시 저장·조회한다. 여행/Day/Place/Polyline ID와 external place ID는 서로 대체 불가. 현재 UI/환경에서 초기 상태를 만들 수 없으면 해당 행은 SETUP_BLOCKED로 남긴다.

## 공통 strict Plan 및 합격 규칙

각 표의 operation 목록을 아래 envelope의 `operations`에 넣는다. `$T`, `$F`, `$D1` 등은 실행 시 확보한 정확한 문자열로 치환한다. `stepId`는 목록 내 유일하고 앞선 생성 결과만 참조한다. 한 JSON object 또는 그 object만 담은 단일 json fence를 허용한다. 설명문+JSON, 복수 문서, JSON repair, unknown field, Trip 전체나 JSON Patch는 실패다.

```json
{"version":1,"base":{"tripId":"$T","fingerprint":"$F"},"operations":[{"stepId":"s1","op":"rename_trip","title":"서울 봄 여행"}]}
```

ordinal은 1부터 시작하고 operation은 최대 20개다. ID ref는 `{ "kind":"id", "id":"실제 canonical ID" }`, 생성 결과 ref는 `{ "kind":"result", "stepId":"앞선 생성 step" }`다. 표의 정확한 순서/필드가 oracle이며 같은 대상을 명확히 가리키는 지원되는 ordinal/name ref는 의미 동등성으로 별도 기록할 수 있다. extra operation, 잘못된 대상, invented ID/좌표는 실패다.

모든 정상 행의 성공은 **실제 지정 GPT 출력 → parser/schema/대상 검증 → 정확한 before/after Preview → 사용자 Apply 1회 → canonical 저장·재조회 → 지도/일정 → 브라우저 reload 유지**를 모두 관측해야 한다. 준비/Preview에서는 local/canonical 상태와 revision이 변하면 실패. Apply 후 표에 없는 의미 필드는 불변, 신규 엔티티는 서버 canonical ID로 재매핑되고 중복·orphan이 없어야 한다. revision/updatedAt 같은 서버 메타데이터 변화는 별도 기록한다. schema 통과만으로 intent PASS를 주지 않는다. 실패 시 원문·전후·오류를 보존하며 실행 안 된 단계는 NOT_RUN이다.

장소 추가/삭제/이동에 수반되는 구조 diff도 필수다. 각 Day의 place.order는 1부터 재정렬, polylines는 인접 pair만 하나씩, layerItems는 place/segment를 번갈아 담는다. 같은 Day 안에서 유지된 pair는 기존 segment ID/mode를 유지하고 새 pair는 straight 및 서버 canonical ID를 가진다. 제거된 pair의 segment와 layer 참조는 남지 않아야 한다. 이 정합 변경은 요청과 무관한 변경으로 오판하지 않되 실제 전후 전체 JSON에 보존한다.

| 행 | 추가로 기대하는 route/layer 구조 diff |
| --- | --- |
| S05/C1/C1b | D1 L1 유지, D2에 P3→new segment 1개 및 대응 layerItems 추가 |
| S06 | D1 P2 제거와 함께 L1 제거, D1 layerItems=[P1] |
| S07/C2 | D1 L1 제거·layerItems=[P2], D2 새 P3→P1 straight segment·[P3,newSegment,P1] |
| C3/C3b | D1/D2 segment/layer 비움, 새 Day에 P1→P2 및 P2→P3 segment 2개·대응 layerItems. 새 Day에서 발급된 segment ID는 따로 기록 |
| 그 외 | 기존 route/layer 구조 유지. S13은 L1 mode만 walking으로 변경 |

## 13개 단일 명령

각 행의 operation은 공통 envelope를 사용하며 base는 그 행의 최신 snapshot이다. 각 행의 증거는 아래 공통 증거 카드 전체를 필수로 채운다.

| ID / 원 T3 | 국내 자연어 | 예상 strict operations | 예상 상태 차이 / 추가 합격·실패 기준 |
| --- | --- | --- | --- |
| KR-S01 / S01 | 여행 이름을 서울 봄 여행으로 바꿔줘. | `[{"stepId":"s1","op":"rename_trip","title":"서울 봄 여행"}]` | title만 변경, Day/Place 전체 불변 |
| KR-S02 / S02 | 새 3일차를 추가하고 이름은 서울 마지막 날로 해줘. | `[{"stepId":"s1","op":"add_day","title":"서울 마지막 날"}]` | 기존 D1,D2 유지, 마지막 새 Day 1개·빈 places, 서버 ID 기록 |
| KR-S03 / S03 | 2일차 이름을 남산 나들이로 바꿔줘. | `[{"stepId":"s1","op":"rename_day","day":{"kind":"id","id":"$D2"},"title":"남산 나들이"}]` | D2 title만 변경, ID·순서 불변 |
| KR-S04 / S04 | 3일차를 맨 앞으로 옮겨줘. | `[{"stepId":"s1","op":"move_day","day":{"kind":"id","id":"$D3"},"position":{"kind":"start"}}]` | Day ID 순서 [D3,D1,D2], 각 내용 불변 |
| KR-S05 / S05 | 2일차 마지막에 서울 종로구 창경궁을 추가해줘. | `[{"stepId":"s1","op":"add_place","day":{"kind":"id","id":"$D2"},"source":{"kind":"search","query":"서울 종로구 창경궁"},"position":{"kind":"end"}}]` | D2 [P3,new], 실제 Places 상세와 canonical 새 ID. 검색 0개는 unresolved, 복수는 ambiguous로 차단; 임의 첫 결과 선택 시 실패 |
| KR-S06 / S06 | 1일차 국립민속박물관을 삭제해줘. | `[{"stepId":"s1","op":"remove_place","place":{"kind":"id","id":"$P2"}}]` | D1 [P1], P2만 제거, P1/P3 유지; destructive Preview와 승인 필수 |
| KR-S07 / S07 | 1일차 경복궁을 2일차 마지막으로 옮겨줘. | `[{"stepId":"s1","op":"move_place","place":{"kind":"id","id":"$P1"},"day":{"kind":"id","id":"$D2"},"position":{"kind":"end"}}]` | D1 [P2], D2 [P3,P1], P1 ID/내용 유지; move_day 출력은 실패 |
| KR-S08 / S08 | 1일차 경복궁의 표시 이름을 경복궁 야간 관람으로 바꿔줘. | `[{"stepId":"s1","op":"rename_place","place":{"kind":"id","id":"$P1"},"name":"경복궁 야간 관람"}]` | P1 name만 변경, 실제 장소 identity·좌표·주소 불변 |
| KR-S09 / S09 | 1일차 경복궁 메모를 한복 입고 관람으로 설정해줘. | `[{"stepId":"s1","op":"set_memo","place":{"kind":"id","id":"$P1"},"memo":"한복 입고 관람"}]` | P1 memo만 변경 |
| KR-S10 / S10 | 1일차 경복궁 방문 시작 시간을 오후 2시로 바꿔줘. | `[{"stepId":"s1","op":"set_visit_time","place":{"kind":"id","id":"$P1"},"time":"14:00"}]` | P1 time 14:00, 두 duration 60 유지; 시간과 분량 혼동 실패 |
| KR-S11 / S11 | 1일차 경복궁 방문 시간을 90분으로 바꿔줘. | `[{"stepId":"s1","op":"set_visit_duration","place":{"kind":"id","id":"$P1"},"minutes":90}]` | 요청 의미: visit 90, time 10:00, preferred 60. **현재 domain은 두 duration을 90으로 결합: 제품 intent GAP**, 현 동작 관측만 별도 기록; 이를 완전 PASS로 처리하지 않음 |
| KR-S12 / S12 | 1일차 경복궁 선호 체류 시간을 120분으로 바꿔줘. | `[{"stepId":"s1","op":"set_preferred_duration","place":{"kind":"id","id":"$P1"},"minutes":120}]` | 요청 의미: preferred 120, visit 60. **현재 domain은 두 duration을 120으로 결합: 제품 intent GAP**. 요구를 삭제하거나 coupled 결과로 oracle을 바꾸지 않음 |
| KR-S13 / S13 | 1일차 경복궁에서 국립민속박물관으로 이어지는 경로를 도보 모드로 바꿔줘. | `[{"stepId":"s1","op":"set_polyline_mode","polyline":{"kind":"id","id":"$L1"},"mode":"walking"}]` | L1 mode walking, ID/endpoints 유지. mode 저장과 실제 Routes 경로·지도 렌더링 검증은 각각 기록; Routes 장애면 지도 단계 BLOCKED |

## 복합 명령

| ID / 원 T3 | 국내 자연어와 초기 상태 | 예상 strict operations | 상태 차이 / 합격 기준 / gate |
| --- | --- | --- | --- |
| KR-C1 / C1 | 기본 상태. 2일차 마지막에 서울 종로구 창경궁을 추가하고 오후 2시부터 90분 머물게 해줘. | `[{"stepId":"s1","op":"add_place","day":{"kind":"id","id":"$D2"},"source":{"kind":"search","query":"서울 종로구 창경궁"},"position":{"kind":"end"},"time":"14:00","visitDurationMinutes":90}]` | D2 [P3,new], new time 14:00/visit 90, 현 domain preferred도 90. 1 add에 옵션을 묶는 지원 형태; 별도 result ref 변형 C1b 아래. Places gate |
| KR-C2 / C2 | 기본 상태. 경복궁을 1일차에서 2일차 마지막으로 옮기고 메모에 야간 관람이라고 적어줘. | `[{"stepId":"s1","op":"move_place","place":{"kind":"id","id":"$P1"},"day":{"kind":"id","id":"$D2"},"position":{"kind":"end"}},{"stepId":"s2","op":"set_memo","place":{"kind":"id","id":"$P1"},"memo":"야간 관람"}]` | D1 [P2], D2 [P3,P1], P1 memo 변경, 동일 ID 보존. 두 변경 모두 원자적으로 저장·reload; 하나만 반영되면 실패 |
| KR-C3 / C3 | 기본 상태, UI 선택 순서 [P1,P2,P3]를 실제 context에 전달해야 함. 3일차를 새로 만들고 이 장소 세 개를 그쪽으로 순서대로 옮겨줘. | `[{"stepId":"s1","op":"add_day","title":"3일차"},{"stepId":"s2","op":"move_place","place":{"kind":"selection","ordinal":1},"day":{"kind":"result","stepId":"s1"},"position":{"kind":"end"}},{"stepId":"s3","op":"move_place","place":{"kind":"selection","ordinal":2},"day":{"kind":"result","stepId":"s1"},"position":{"kind":"end"}},{"stepId":"s4","op":"move_place","place":{"kind":"selection","ordinal":3},"day":{"kind":"result","stepId":"s1"},"position":{"kind":"end"}}]` | 새 Day [P1,P2,P3], D1/D2 빈 places, ID multiset 동일. **recovery UI selection=[]이므로 원문 형태 GAP**. 빈 선택으로 이 Plan을 생성/적용하면 실패 |

C1b는 result-reference 별도 검사다. 요청: “창경궁을 2일차 끝에 추가한 뒤 그 새 장소에 야간 관람이라고 메모해줘.” C1의 add에서 time/duration을 빼고 s2=`{"stepId":"s2","op":"set_memo","place":{"kind":"result","stepId":"s1"},"memo":"야간 관람"}`를 뒤에 붙인다. 기대 diff는 새 장소 하나와 그 memo뿐이며, 새 entity 참조가 canonical save 후에도 정확해야 한다.

C3b는 선택 연결을 대신 통과시키는 케이스가 아니다. “3일차를 새로 만들고 경복궁, 국립민속박물관, 남산서울타워를 그 순서로 옮겨줘”라는 별도 요청을 사용하고 C3의 selection refs만 P1/P2/P3 ID refs로 바꾼다. C3 원본은 GAP으로 유지하고 C3b 결과를 별도 보존한다.

## 거절·경합·실패 시나리오

각 행도 공통 증거 카드 전체와 원본 요청/Plan을 보존한다. 정상 GPT가 위험 Plan을 만들지 않으면 그 응답 자체를 안전성 관측으로 기록하고, engine 안전성 검증과 구분한다. UI에 인위적 assistant 응답을 주입하지 않는다.

| ID | 자연어 / 실제 초기 조건과 행동 | 예상 Plan/거절 및 상태 차이 | 성공/실패와 실행 gate |
| --- | --- | --- | --- |
| KR-N01 ambiguity | 기본 여행 D1/D2에 별개 ID인 같은 표시명 `카페`를 실제 등록. “카페를 삭제해줘.” | clarification, Apply 없음. name ref Plan이 나와도 prepare ambiguous_target. diff=0 | 임의 선택/삭제 실패. 명확화 후 재요청은 새 F/새 evidence |
| KR-N02 cancel | S06 요청으로 실제 Preview를 연 뒤 Cancel; 다시 reload | S06 Plan 존재 가능, execute/save 0, P2 유지, revision 불변 | 취소 후 자동 적용/저장 실패. 생성 도중 취소도 별도 subrun으로 late response/다른 Trip 오염 없음 확인 |
| KR-N03 stale | S01 Preview 이후 일반 UI에서 D2 제목을 수정·저장하고 이전 Preview Apply | 이전 F 불일치, stale_plan/적용 불가. diff는 intervening edit만 | 이전 Plan의 제목 변경이 섞이면 실패. 새 요청/새 F 필요 |
| KR-N04 conflict | 동일 T/R을 두 실제 브라우저 세션에서 읽음. A에서 S01 Preview, B에서 제목을 `다른 세션 변경`으로 저장 후 A Apply | 서버 revision conflict, A 성공 표시 없음; canonical은 B 변경만 | A가 B를 덮어쓰거나 성공 표시 시 실패. 실제 revision 저장소 필요; PostgreSQL 판정은 PostgreSQL에서만 |
| KR-N05 partial preparation | “여행 이름을 서울 수정으로 바꾸고 99일차 경복궁 메모를 확인으로 바꿔줘.” | 정상 응답은 clarification. Plan이 두 op를 포함하면 schema 또는 unresolved_target로 전체 거절, 첫 rename도 미반영 | diff=0; 대상 없는 뒤 op 때문에 앞 op만 실행되면 실패. exact rejected JSON/error 기록 |
| KR-N06 atomic save failure | C2 실제 Preview까지 준비. 전용 로컬 개발 서버를 저장 직전 정상 중단하여 실제 연결 실패 후 Apply; 서버 복구 후 재조회 | 성공 표시 없음, local은 마지막 확정 snapshot, canonical은 요청 미도달이면 before. 네트워크 상태/저장 단계 기록 | mock/fault injection 없음. 전용 서버 소유권·재시작 권한이 있을 때만 시행; 다른 사용자 서버 중단 금지. 원인/도달 여부 불명은 UNKNOWN_COMMIT으로 분리 |
| KR-N07 lost acknowledgement | C2 승인 중 실제 네트워크 단절이 commit 뒤 발생한 관측이 있을 때만 실행 증거로 채택; 복구 후 canonical 재조회 | canonical은 before 또는 완전한 C2, 부분 적용 금지. 앱은 readback 전 성공 금지, 자동 재적용 금지 | 실제 commit timing 증거 없으면 NOT RUN/환경 gate. before로 보였다는 이유만으로 서버 rollback 보장 주장 금지 |
| KR-N08 invalid/foreign target | 다른 여행의 실제 place ID를 가리키는 모델 Plan이 관측되거나 “다른 여행의 경복궁을 이 여행에서 삭제해줘” 요청 | clarification 또는 unresolved_target; 다른 Trip 접근/변경 없음, diff=0 | provider가 invented ID 반환하면 generation FAIL + guard 결과 별도. 예시 조작물을 GPT 결과로 기록 금지 |
| KR-N09 unsupported/strict | “2일차를 삭제해줘.” / 실제 응답에 remove_day, extra field, 잘린 JSON, 복수 JSON이 나오면 각각 별도 subrun | remove_day는 13-op schema 미지원, 적용 없음. malformed는 json_parse/schema_invalid; no repair | 지원 안 되는 요구는 GAP 유지. 엉뚱한 지원 op로 대체하면 intent FAIL; diff=0 |
| KR-N10 duration atomicity | “2일차 끝에 창경궁을 추가하고 방문 90분, 선호 체류 120분으로 각각 설정해줘.” | 둘을 독립 저장할 수 없어 GAP. add_place의 두 값이 다르면 recovery guard unsafe_operation; diff=0 기대 | 원본 add-only guard 범위와 여러 step으로 우회하는 경우를 각각 검토. 한 duration을 조용히 덮어쓰거나 일부 추가 시 실패; Places/config 및 domain 지원 gate |

## 행별 증거 카드 (복사하여 수동 작성)

```text
scenarioId / subrun / 원 T3 ID / requirement ID:
status: NOT_RUN | BLOCKED | PASS | FAIL | UNKNOWN_COMMIT
gate와 미실행 단계 / 시작·종료 UTC / 실행자 / 독립 검토자:
build SHA + dirty diff 식별자 / branch / environment URL / persistence mode:
리드의 제품 provider·정확한 GPT model 확인 근거 / endpoint(비밀 제외):
requested model / observed provider-model metadata / fallback 없음 확인:
request 원문 / selection 순서 / 실제 context 원문 / prompt 길이:
before canonical JSON / T,R,F,D1,D2,D3,P1,P2,P3,L1 매핑:
raw provider output (잘림·fence 포함 원문) / finishReason / request ID:
parse + schema + target + intent 판정과 오류 code/stepId:
expected operations / actual strict Plan / operation 순서 비교:
preview before-after JSON / risk / screenshot / preview 무변경 readback:
Apply 또는 Cancel 시각 / 중복 클릭·경합 / execution 결과:
save request-response 식별자·revision / canonical readback / after JSON:
예상 diff / 실제 diff / 불변 필드 / 신규 canonical ID·orphan 점검:
지도·일정 screenshot / 브라우저 reload 후 JSON·screenshot:
model/parse/prepare/execute/save/reload/total latency:
오류·차단·수정·재시도 이력 (실패 삭제 금지):
판정 근거 / 남은 의존성 / cleanup(사용자 승인 범위 내):
```

현재 문서 작성에서는 새 제품 실행이 없으므로 raw output, 실제 ID, PASS를 채우지 않았다. 역사적 T3 evidence의 지연·전후·raw output은 보존본에서 확인한다. canonical GET만으로 브라우저 Reload PASS를 추론하지 않는다. 취소/거절은 성공적인 안전성 결과일 수 있으나 정상 명령 적용 PASS와 합산하지 않는다.
