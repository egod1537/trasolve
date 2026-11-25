# 여행지 지식베이스와 추천 연동 계약

## 데이터 범위

기존 [여행 DB](https://docs.google.com/spreadsheets/d/1A8owaVq4PnupYjS3wSOWKcIr1QMMGJyp6l-AfHZtuhQ/edit)의 한국·일본·몽골 탭에서 각각 200개 항목을 수집했다. 스냅샷은 지역, 장소명과 별칭, 분류, 추천 포인트, 대상과 태그, 시기·체류 가이드, 출처를 저장한다. 검증한 대표 단일 장소 6건에는 출처가 있는 좌표를 추가했다.

행에는 단일 장소와 여러 장소를 묶은 여행지가 함께 들어 있다. `source.kind`는 시트가 기입한 공식·가이드·커뮤니티·공개 데이터 등의 출처 구분이다. `source.collectedOn`은 시트에 기록된 수집일이다. 검색 결과를 현재 운영시간, 예약 가능 여부, 실제 이동 시간이나 지도상 단일 장소 ID로 사용하지 않는다. 시기와 체류시간은 추천 참고값이다.

### 좌표와 출처

`coordinates`는 선택 필드이며 `{ lat, lng, sourceUrl }` 형식의 WGS 84 좌표를 제공한다. 값은 출처가 지정한 해당 장소의 대표 지점이다. 좌표 표시 여부는 이 필드로 판별한다. 복합 여행지나 좌표가 미확인·불일치한 행에는 좌표를 추가하지 않는다.

| 국가 | 확인한 대표 장소 | 확인 경로 |
| --- | --- | --- |
| KR | 창덕궁, 국립중앙박물관 | 원본 시트와 Wikidata 구조화 좌표 대조. [UNESCO 창덕궁](https://whc.unesco.org/en/list/0816/maps/)과 [국립중앙박물관](https://www.museum.go.kr/ENG/contents/E0105030000.do)으로 장소 확인 |
| JP | 히메지성, 도쿄 국립박물관 | [Wikidata 히메지성](https://www.wikidata.org/wiki/Q188754#P625)으로 시트의 Google Maps 기준값을 대체. [UNESCO 히메지성](https://whc.unesco.org/en/list/661/maps/)과 [도쿄 국립박물관](https://www.tnm.jp/modules/r_free_page/index.php?id=113-0&lang=en)으로 장소 확인 |
| MN | 간단 사원, Ordu-Baliq | 원본 시트와 Wikidata 구조화 좌표 대조. [울란바토르 관광 안내](https://visitulaanbaatar.net/storage/files/Guide%20book%2020211026.pdf)와 [UNESCO 오르혼 계곡](https://whc.unesco.org/en/list/1081/)으로 장소 확인 |

추가한 좌표의 재배포 근거는 [Wikidata 구조화 데이터 CC0](https://www.wikidata.org/wiki/Wikidata:Licensing)다. 기관 페이지는 장소 확인에 사용했다. [Google Maps 데이터 저장 정책](https://developers.google.com/maps/documentation/places/web-service/policies)에 따라 시트의 Google Maps 기준 좌표는 가져오지 않는다. 자이승전망대와 Amarbayasgalant Monastery는 대조한 수치가 일치하지 않아 좌표를 제외했다. 기존 가이드·커뮤니티 링크는 출처로 유지하고, 새 원문·지도·사진은 수집하지 않았다.

## T3 조회 인터페이스

Trasolve backend에서 `backend/src/destinationKnowledge/index.ts`를 사용한다. 함수는 동기식이며 호출할 때 외부 Provider·HTTP·DB에 접근하지 않는다.

```ts
searchDestinationKnowledge({
  query: '창덕궁',
  region: '서울',
  preference: '궁궐',
  countryCode: 'KR',
  limit: 5,
});
getDestinationKnowledge(destinationId);
```

| 함수 | 입력 | 응답 |
| --- | --- | --- |
| `searchDestinationKnowledge` | 선택적인 `query`, `region`, `preference` 각각 1~200자, `countryCode` `KR\|JP\|MN`, `limit` 정수 1~20. 기본 limit 8 | `{ datasetVersion, snapshotUpdatedAt, items }`. 결과가 없으면 `items: []`. 잘못된 입력은 `ZodError` |
| `getDestinationKnowledge` | 검색 응답에 있는 지식베이스 `id` | `{ datasetVersion, snapshotUpdatedAt, item }`. ID가 없으면 `item: null` |

검색어와 이름은 Unicode NFKC와 소문자로 정규화하고 구두점을 단어 구분으로 취급한다. 검색어의 모든 단어가 이름, 별칭, 지역, 분류, 추천 포인트, 추천 대상 또는 태그에 있어야 한다. 이름 전체 일치, 이름에 포함된 단어 수, 동일 점수에서는 ID 순으로 정렬한다. `region`은 권역과 도시·지역을, `preference`는 분류·추천 대상·태그를 검색한다. 지정한 필터는 모두 충족해야 하며, 국가만으로도 조회할 수 있다.

각 항목은 `id`, `countryCode`, `region`, `locality`, `name`, 선택적 `alternateName`, `category`, `highlights[]`, `audiences[]`, 선택적 `bestSeason`·`suggestedStay`, `tags[]`, 선택적 `coordinates`, `source { kind, name, url, language?, collectedOn }`을 제공한다. `id`는 국가와 정규화한 권역·도시·이름으로 생성한다. 내용이나 태그 수정 시 ID는 유지되고, 주소 역할을 하는 권역·도시·이름 변경 시에는 새 ID가 생성될 수 있다. T3는 결과에 원본 `source.url`을 연결하고, 문구를 데이터로 취급한다. 검색 결과를 캐시하는 경우 정규화된 조회 조건과 `datasetVersion`을 키에 포함한다.

## 제품 HTTP API

기존 Trasolve 세션 쿠키와 동의 상태를 적용하는 같은 출처의 읽기 전용 경로다.

- `GET /api/destination-knowledge?countryCode=KR&region=서울&preference=궁궐&query=창덕궁&limit=5`
- `GET /api/destination-knowledge/<검색 결과 id>`

응답 본문은 위 조회 계약과 같다. 세션이 없으면 401, 잘못되거나 중복된 검색 파라미터 또는 잘못된 ID 형식은 400, 등록되지 않은 유효 ID는 404, GET 이외 메서드는 405다. HTTP 응답은 공유 캐시를 사용하지 않는다.

## 수집과 갱신

1. 여행 DB에서 한국·일본·몽골 각 탭의 `A1:R<마지막 데이터 행>`을 읽는다. 1행의 헤더를 포함한 Sheets 값 배열을 각각 `KR`, `JP`, `MN` 키로 하는 JSON 객체로 모은다. 범위 조회의 응답 객체를 저장했다면 `values` 배열만 사용한다.
2. 저장소 루트에서 새 후보 파일을 생성한다. 세 나라의 헤더, 필수 필드, 출처 URL·날짜와 ID 중복을 검사한 뒤 새 파일을 쓴다.
3. 행 수와 변경 내용을 검토한 다음 `backend/src/destinationKnowledge/destinations.json`을 교체하고 PR로 제출한다. 이전 버전은 Git에 보존된다. 배포된 프로세스는 빌드에 포함된 스냅샷을 읽는다. 가져오기는 ID가 유지되는 행의 검증 좌표를 보존한다. 좌표를 추가·수정할 때는 출처와 함께 스냅샷에 반영하고 갱신 시각을 UTC로 기록한다.

```sh
node --import tsx backend/src/destinationKnowledge/importCli.ts \
  /path/to/sheet-export.json /path/to/new-destinations.json
./node_modules/.bin/prettier --write /path/to/new-destinations.json
```

`source.collectedOn`은 행의 원본 수집일이고, `snapshotUpdatedAt`은 현재 스냅샷이 바뀐 UTC 시각이다. 같은 내용을 다시 가져오면 기존 갱신 시각을 유지한다. `datasetVersion`은 좌표를 포함한 정규화 데이터의 SHA-256이며 갱신 시각 자체는 해시에 포함하지 않는다.
