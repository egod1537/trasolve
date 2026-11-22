# 여행지 지식베이스와 추천 연동 계약

## 데이터 범위

기존 [여행 DB](https://docs.google.com/spreadsheets/d/1A8owaVq4PnupYjS3wSOWKcIr1QMMGJyp6l-AfHZtuhQ/edit)의 한국·일본·몽골 탭에서 각각 200개 항목을 수집했다. 최초 스냅샷에는 지역, 장소명과 별칭, 분류, 추천 포인트, 대상과 태그, 시기·체류 가이드, 출처를 저장한다. 원본 시트의 운영 정보와 지도 좌표는 저장하지 않는다.

행에는 단일 장소와 여러 장소를 묶은 여행지가 함께 들어 있다. `source.kind`는 시트가 기입한 공식·가이드·커뮤니티·공개 데이터 등의 출처 구분이다. `source.collectedOn`은 시트에 기록된 수집일이다. 검색 결과를 현재 운영시간, 예약 가능 여부, 실제 이동 시간이나 지도상 단일 장소 ID로 사용하지 않는다. 시기와 체류시간은 추천 참고값이다.

작업 지시에 명시된 여행지 수집·저장·검색·갱신 범위를 적용했다. Notion 원본 행의 세부 합격 기준과 W9 네 테이블 정의는 확보하지 못했다. 이 구현의 저장 범위는 Git으로 버전 관리되는 정적 카탈로그다.

## T3 조회 인터페이스

Trasolve backend에서 `backend/src/destinationKnowledge/index.ts`를 사용한다. 함수는 동기식이며 호출할 때 외부 Provider·HTTP·DB에 접근하지 않는다.

```ts
searchDestinationKnowledge({
  query: '서울 궁궐',
  countryCode: 'KR',
  limit: 5,
});
getDestinationKnowledge(destinationId);
```

| 함수 | 입력 | 응답 |
| --- | --- | --- |
| `searchDestinationKnowledge` | 선택적인 `query` 1~200자, `countryCode` `KR\|JP\|MN`, `limit` 정수 1~20. 기본 limit 8 | `{ datasetVersion, items }`. 결과가 없으면 `items: []`. 잘못된 입력은 `ZodError` |
| `getDestinationKnowledge` | 검색 응답에 있는 지식베이스 `id` | `{ datasetVersion, item }`. ID가 없으면 `item: null` |

검색어와 이름은 Unicode NFKC와 소문자로 정규화하고 구두점을 단어 구분으로 취급한다. 검색어의 모든 단어가 이름, 별칭, 지역, 분류, 추천 포인트, 추천 대상 또는 태그에 있어야 한다. 이름 전체 일치, 이름에 포함된 단어 수, 동일 점수에서는 ID 순으로 정렬한다. 국가만으로도 조회할 수 있다. 추천 단계가 지역이나 관심사 단어를 추려 전달한다.

각 항목은 `id`, `countryCode`, `region`, `locality`, `name`, 선택적 `alternateName`, `category`, `highlights[]`, `audiences[]`, 선택적 `bestSeason`·`suggestedStay`, `tags[]`, `source { kind, name, url, language?, collectedOn }`을 제공한다. `id`는 국가와 정규화한 권역·도시·이름으로 생성한다. 내용이나 태그 수정 시 ID는 유지되고, 주소 역할을 하는 권역·도시·이름 변경 시에는 새 ID가 생성될 수 있다. T3는 결과에 원본 `source.url`을 연결하고, 문구를 데이터로 취급한다. 검색 결과를 캐시하는 경우 정규화된 조회 조건과 `datasetVersion`을 키에 포함한다.

## 수집과 갱신

1. 여행 DB에서 한국·일본·몽골 각 탭의 `A1:R<마지막 데이터 행>`을 읽는다. 1행의 헤더를 포함한 Sheets 값 배열을 각각 `KR`, `JP`, `MN` 키로 하는 JSON 객체로 모은다. 범위 조회의 응답 객체를 저장했다면 `values` 배열만 사용한다.
2. 저장소 루트에서 새 후보 파일을 생성한다. 세 나라의 헤더, 필수 필드, 출처 URL·날짜와 ID 중복을 검사한 뒤 새 파일을 쓴다.
3. 행 수와 변경 내용을 검토한 다음 `backend/src/destinationKnowledge/destinations.json`을 교체하고 PR로 제출한다. 이전 버전은 Git에 보존된다. 배포된 프로세스는 빌드에 포함된 스냅샷을 읽는다. 조회 응답의 `datasetVersion`은 정규화된 스냅샷의 SHA-256으로 생성된다.

```sh
node --import tsx backend/src/destinationKnowledge/importCli.ts \
  /path/to/sheet-export.json /path/to/new-destinations.json
./node_modules/.bin/prettier --write /path/to/new-destinations.json
```
