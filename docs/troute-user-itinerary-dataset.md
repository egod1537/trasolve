# troute 실사용자 기반 여행 일정 데이터셋

`docs/data/troute-real-user-itineraries-100.json`은 공개된 실제 사용자 여행
일정에서 반복되는 동선을 추출해 만든 `troute`용 하루 일정 100건이다.

- 서울 50건, 몽골 50건
- 지역별 실제 사용자 일정 템플릿 10개에 5가지 제약 변형 적용
- 각 요청에 4~7개 장소, 고정 시작·종료점, 영업 시간, 체류 시간, 좌표,
  방향별 이동 시간 행렬 포함
- 서울은 `TRANSIT`, 몽골은 `DRIVING`으로 구성
- 입력 순서의 알려진 실행 가능 스케줄과 실제 `troute` 최적화 결과 포함

## 중요한 해석 범위

이 파일의 100건은 서로 다른 100명의 원문 일정을 그대로 복제한 것이 아니다.
디시인사이드와 Reddit의 실제 사용자 일정·여행기에서 지역 묶음과 하루 이동
패턴을 추출하고, 기존 관광지 DB와 Google Maps 좌표를 결합한 뒤 시작 시각,
체류 시간, 장소 수, 시간창을 바꾼 테스트 변형이다.

`travel_time_matrix`도 실시간 교통 응답이 아니다. 좌표 간 직선거리에 지역별
우회 계수, 평균 속도, 고정 오버헤드를 적용한 결정적 추정값이다. 따라서 이
데이터셋은 `troute`의 순서 최적화와 시간창 스케줄링을 반복 검증하는 용도이며,
실제 출발 직전의 교통·휴관일·계절 운영 정보를 대신하지 않는다.

## 검증 결과

2026-11-12에 현재 `troute` 소스로 바이너리를 빌드한 뒤 100건 모두를 실제로
실행했다.

- `POST /validate`: 100/100 `input_valid=true`, `schedule_feasible=true`
- `POST /optimize`: 100/100 HTTP 200 및 경로 반환

각 테스트셋의 `verification`에는 검증 시각, 응답 상태, 최적 순서, 선택된 시작
시각, 종료 시각, 총 이동 시간이 들어 있다. 이 데이터셋에서 “해가 존재한다”는
입력 순서가 독립 검증을 통과하고 동일 요청의 최적화가 성공했다는 뜻이다.

배포 서버에서도 같은 100건을 다시 실행했다. 검증·최적화가 모두 성공했으며,
로컬 기준과 경로 순서 및 총 이동 시간이 100/100건 일치했다. 실행 방법, 응답
시간 및 해석 범위는
[`troute-production-verification-report.md`](troute-production-verification-report.md)에
기록했다.

## 사용 예

특정 요청을 꺼내 현재 실행 중인 `troute`에 보낼 수 있다.

```sh
jq '.testsets[] | select(.id == "SEOUL-001") | .request' \
  docs/data/troute-real-user-itineraries-100.json \
  > /tmp/troute-seoul-001.json

curl -X POST http://127.0.0.1:8080/optimize \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/troute-seoul-001.json
```

Google Sheets 산출물에는 같은 데이터를 다음 탭으로 나눠 두었다.

- `개요`: 범위와 검증 결과
- `테스트셋`: 100건 요약과 입력·최적 순서 비교
- `정류장`: 장소별 좌표, 시간창, 체류 시간, 알려진 실행 가능 시각
- `요청JSON`: 복사 가능한 전체 `OptimizeRouteRequest`
- `출처`: 실제 사용자 일정과 관광지 DB 출처
