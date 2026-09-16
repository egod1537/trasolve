# Google Maps 드래그/줌 성능 병목 조사

## 0. 결론 요약

조사 기준은 `impl` 브랜치의 `98417ee` 커밋이다. 고정 Trip에서 줌 프레임 드롭의 1차 원인은 **React 렌더나 카메라 상태 순환이 아니라, 지도에 연결된 Trasolve polyline 9개를 Google Maps가 줌마다 다시 투영하고 rasterize하는 비용**이다.

정확한 분류는 **E. 복합 원인**이다. 다만 여기서 복합 원인은 “여러 Trasolve effect가 서로 갱신을 반복한다”는 뜻이 아니다.

- 1차: Trasolve가 생성해 계속 연결해 둔 `google.maps.Polyline`과 그 symbol icon을 Google Maps 내부 renderer가 줌마다 처리하는 비용
- 2차: TripLayer가 없어도 남는 Google 기본 지도 viewport 갱신, tile/raster/GPU 비용
- 3차: 드래그 시 `AdvancedMarkerElement` 내부 위치 계산에 따른 많은 geometry read. 이 장비에서는 호출 수는 많았지만 p95 악화는 작았다.
- 확대 시 선택하지 않은 marker를 숨기는 현재 `impl` 동작은 marker geometry read를 크게 줄이지만, polyline 병목은 줄이지 않는다. idle 경계가 여러 번 발생하면 marker detach/attach와 진입 애니메이션이 반복되어 사용자가 본 “마커가 확 튀는” 현상을 만들 수 있다.

반대로 다음 가설은 이번 고정 시나리오에서 주 병목이 아니었다.

- `focusMap`, `fitBounds`, `ResizeObserver` 반복 실행
- drag/zoom 중 `trip` reference 변경으로 인한 전체 marker/polyline setter 재호출
- React `GoogleMap`/`TripLayer` render 비용
- 정적인 Map toolbar, LayerPanel, AI panel 등 React DOM chrome
- forced reflow 또는 큰 Layout/Paint 작업

## 1. 재현 환경

| 항목 | 값 |
| --- | --- |
| 브랜치 / 커밋 | `impl` / `98417ee` |
| 실행 모드 | Vite development, React 19.2.8 (`StrictMode` 영향은 별도 표기) |
| OS | Windows 11 Pro 10.0.26200, build 26200 |
| CPU / RAM | AMD Ryzen 7 6800HS, 8C/16T / 39.3 GB |
| GPU | Chrome 실제 renderer: AMD Radeon Graphics, ANGLE D3D11, driver 31.0.12024.2005 |
| 브라우저 | Chrome 152.0.7977.84, 새 headless profile |
| Node | v24.14.0 |
| 창 / 지도 canvas | 1440×1000 / 약 1422×904 |
| Google Maps JS | `/maps-api-v3/api/js/66/4d/intl/ko_ALL` |
| Trip | `409880f4-1556-46a7-87fa-9dfbf23328fd`, “도쿄, 3일의 여행” |
| 지도 객체 | 4일, place/marker 12개, polyline 9개 |

Polyline 9개는 transit 3개, straight 6개다. 저장된 상세 `path`가 없어 모두 출발지와 도착지만 잇는 2-point fallback path였다. 따라서 이번 결과는 “경로 point가 너무 많아서” 발생한 현상이 아니다. 모든 선에는 방향 symbol이 있고 transit 선에는 station pattern symbol도 있다.

새 Chrome profile 사이에서 화면 refresh cadence가 약 165 Hz와 60 Hz로 달라지는 경우가 있었다. 서로 다른 cadence의 절대 평균은 비교하지 않았고, 원인 분리의 핵심 비교는 동일 profile·동일 입력에서 수행했다. max는 OS/GPU scheduling에 민감하므로 p95/p99와 초과 프레임 수, 3회 반복 중앙값을 함께 사용했다.

## 2. 재현 및 계측 절차

### 고정 시나리오

Trip을 연 뒤 초기 `fitBounds`, tile load, React mount가 끝나도록 3초 기다리고 다음 5초 구간을 각각 새로 기록했다.

1. A — 아무 조작 없이 5초
2. B — 지도 위를 좌우로 연속 pointer drag 5초
3. C — wheel zoom in 2.5초, zoom out 2.5초
4. D — 좌우 drag와 wheel zoom을 함께 5초

각 시나리오는 일반 실행과 Chrome trace recording 실행으로 나누었다. 입력 좌표, 기간, Trip, viewport는 고정했다.

### 계측 방법

분석 중에만 다음 계측을 붙였다.

- 앱 코드에는 메모리 내 숫자 counter만 증가시켰다.
- `console.log`는 조작 중 호출하지 않았고, 5초 종료 뒤 snapshot을 한 번만 읽었다.
- `requestAnimationFrame` 간격, `PerformanceObserver` long task, `getBoundingClientRect`, `ResizeObserver`, style/class attribute mutation은 페이지 로드 전에 주입한 probe로 집계했다.
- Chrome DevTools Protocol trace와 CPU profile로 main thread, compositor/GPU, raster worker call stack을 함께 수집했다.
- 초기 mount/sync 호출은 reset 뒤의 5초 interaction counter에 포함하지 않았다.

임시 feature flag로 `TripLayer 없음`, marker-only, polyline-only, zoom visibility off, focus/resize off, map UI off, polyline icon 변형을 만들었다. 조사 후 probe, runner, flag는 모두 제거했다. 제품 동작 변경이나 최적화 코드는 남기지 않았다.

## 3. 기존 프로파일링 데이터 해석

기존 React Profiler 수치는 이번 조사 결과와 일치한다.

- `GoogleMap` commit 약 0.4~1.0 ms
- `TripObjects` / `TripLayer` render 자체는 작음
- `GoogleMap` passive effect 약 1.2~2.5 ms
- 초기 페이지 render에서 `MapPage` 약 127 ms, `MapWorkspace` 약 120 ms, `LayerPanel` 약 102 ms, `LayerPanelContent` 약 98 ms

초기 LayerPanel 비용은 별도 최적화 후보지만, drag/zoom 5초 구간에는 재실행되지 않았다. React Profiler의 render duration만으로 Google Maps 내부 projection, raster, GPU 시간을 볼 수 없다는 점도 trace로 확인됐다.

## 4. 코드상 의심 지점과 실제 호출 관계

### 카메라 이벤트

`createGoogleMapRuntime.ts`는 제품 코드에서 `click`, `center_changed`, `zoom_changed`만 구독한다. `drag`, `dragstart`, `dragend`, `bounds_changed`, `tilesloaded`는 앱 상태 갱신용으로 구독하지 않는다. 분석 probe에서만 횟수를 세었다.

`GoogleMap.tsx`는 `zoom_changed`에서 `setIsZooming(true)`를 요청하고, `GoogleMapAdapter.subscribeCameraChange()`가 연결한 `idle`에서 `setIsZooming(false)`를 요청한다. `center_changed`는 latest callback을 호출하지만 현재 Map 페이지에서는 React camera state로 되먹이지 않는다.

### Context reference

`MapContext` 값은 `[runtime, isZooming]`으로 memoize되어 있다. 다음 reference는 runtime 생존 기간 동안 안정적이다.

- `adapter`
- `objects`
- `overlayHost`
- `canvasRef`

drag나 `center_changed`만으로 Context value가 새로 생성되지 않는다. zoom에서 `isZooming`이 실제로 false→true 또는 true→false가 될 때만 값이 바뀐다. 반복되는 `setIsZooming(true)` 요청은 React가 같은 값으로 접는다.

### focusMap / ResizeObserver

`GoogleMapView.tsx`의 `focusMap`은 mount, `focusTarget` reference 변경, canvas/sidebar resize에만 실행된다. 내부의 `getBoundingClientRect`, `subscribeCameraChange`, `fitBounds`, 조건부 `setZoom`은 일반 drag/zoom 5초 구간에서 실행되지 않았다.

### TripLayer 동기화

초기 sync effect는 `[objects, tripId, trip]`에 의존하며 marker마다 `setPosition`, `setTitle`, `setColor`, `setIcon`, `setSelected`, `setEmphasis`, `setVisible`, `setZIndex`를 호출한다. 그러나 camera movement는 `trip` reference를 바꾸지 않았고 이 effect는 interaction 중 0회였다.

Polyline은 path, style key, visibility, z-index를 `OwnedPolyline`에 저장하고 값 비교 후에만 setter를 호출한다. zoom/drag 동안 polyline setter는 모두 0회였다. 즉 선이 비싼 이유는 반복적인 Trasolve setter가 아니라, 이미 지도에 붙어 있는 선을 Google renderer가 매 zoom frame 다시 그리기 때문이다.

### Google Maps 객체 구현

- marker는 `AdvancedMarkerElement`와 SVG DOM content다.
- marker `setVisible`은 내부 `visible`과 같은 값이면 즉시 반환한다. 실제 변경 시 `marker.map`을 map/null로 바꾸고 다시 나타날 때 `is-entering` class를 붙인다.
- polyline은 `google.maps.Polyline`이다.
- 각 선 style은 stroke 외에 반복 symbol icon을 생성한다. direction은 중앙 arrow와 반복 arrow, transit은 station pattern을 더한다.

## 5. 기준 시나리오 결과

다음 표는 약 165 Hz로 동작한 같은 Chrome profile의 일반 실행 대표값이다. `>16.7`은 rAF 간격이 16.7 ms를 넘은 횟수다.

| 시나리오 | 평균 ms | p95 ms | p99 ms | max ms | >16.7 | >33.3 | >50 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A idle | 6.074 | 6.2 | 6.2 | 12.2 | 0 | 0 | 0 |
| B drag | 6.116 | 6.2 | 6.3 | 18.1 | 1 | 0 | 0 |
| C zoom | 6.977 | 12.1 | 30.2 | 115.2 | 18 | 5 | 2 |
| D mixed | 7.364 | 12.1 | 24.2 | 284.8 | 21 | 5 | 3 |

max는 반복 간 변동이 컸다. 예를 들어 full-layer zoom 3회 중앙값은 p95 약 12.0 ms, max 72.7 ms, `>16.7` 15회였다. 따라서 단일 284.8 ms outlier만으로 판정하지 않았다.

### Performance recording 유무

| 시나리오 | 일반 max ms | trace max ms | 해석 |
| --- | ---: | ---: | --- |
| A idle | 12.2 | 12.0 | 차이 없음 |
| B drag | 18.1 | 18.2 | 차이 없음 |
| C zoom | 115.2 | 151.4 | recording 중 zoom outlier 증가 |
| D mixed | 284.8 | 90.8 | max 자체의 큰 run-to-run 변동 |

Trace의 `CpuProfiler::StartProfiling`과 idle에서도 나타난 105~336 ms `Receive mojo message`는 측정 transport artifact로 제외했다. 해당 구간은 rAF max 및 `PerformanceObserver` long task와 일치하지 않았기 때문이다.

## 6. 이벤트와 API 호출 횟수

### 지도 이벤트와 React/effect

5초 interaction window의 대표 counter다. 개발 build의 render counter는 StrictMode로 배수가 될 수 있으므로 호출 관계 확인용이다.

| 항목 | A idle | B drag | C zoom | D mixed |
| --- | ---: | ---: | ---: | ---: |
| `dragstart` | 0 | 1 | 0 | 1 |
| `drag` | 0 | 164 | 0 | 138 |
| `dragend` | 0 | 1 | 0 | 1 |
| `center_changed` | 0 | 165 | 17 | 24 |
| `zoom_changed` | 0 | 0 | 17 | 16 |
| `bounds_changed` | 0 | 165 | 17 | 24 |
| interaction 중 `idle` camera callback | 0 | 0 | 0 | 3 |
| `tilesloaded` | 0 | 0 | 0 | 0 |
| `setIsZooming(true)` 요청 | 0 | 0 | 17 | 16 |
| `setIsZooming(false)` 요청 | 0 | 0 | 0 | 3 |
| `GoogleMap` render | 0 | 0 | 4 | 18 |
| Context value 생성 | 0 | 0 | 2 | 12 |
| `TripObjects` render | 0 | 0 | 2 | 12 |
| `TripLayer` render | 0 | 0 | 2 | 12 |
| TripLayer 전체 sync effect | 0 | 0 | 0 | 0 |
| TripLayer visibility effect | 0 | 0 | 1 | 6 |

C는 snapshot 시점 전에 마지막 terminal `idle`이 오지 않은 run이다. D는 drag와 wheel 사이의 짧은 정지에서 `idle`이 3번 발생해 false/true 전환이 반복됐다. 이 때문에 같은 5초 mixed 입력도 Context/render/visibility 횟수 변동이 있었다.

### 지도 객체 setter

| API | A idle | B drag | C zoom | D mixed |
| --- | ---: | ---: | ---: | ---: |
| `marker.setVisible` | 0 | 0 | 12 | 72 |
| `marker.setVisible` 실제 map attach/detach | 0 | 0 | 12 | 72 |
| `marker.setPosition` | 0 | 0 | 0 | 0 |
| `marker.setTitle` | 0 | 0 | 0 | 0 |
| `marker.setIcon` | 0 | 0 | 0 | 0 |
| `marker.setColor` | 0 | 0 | 0 | 0 |
| `marker.setSelected` | 0 | 0 | 0 | 0 |
| `marker.setEmphasis` | 0 | 0 | 0 | 0 |
| `marker.setZIndex` | 0 | 0 | 0 | 0 |
| `polyline.setPath` | 0 | 0 | 0 | 0 |
| `polyline.setStyle` | 0 | 0 | 0 | 0 |
| `polyline.setVisible` | 0 | 0 | 0 | 0 |
| `polyline.setZIndex` | 0 | 0 | 0 | 0 |
| `fitBounds` | 0 | 0 | 0 | 0 |
| `setZoom` | 0 | 0 | 0 | 0 |

초기 Trip sync에서는 marker 12개에 여러 setter가 한 번씩 호출되지만 이 호출은 camera movement와 독립적이었다. `polyline.add` 초기 counter가 StrictMode remount 때문에 18로 보이는 run이 있었으나 API 데이터와 최종 지도 객체 수는 9개다.

### DOM/layout 관련 counter

| 항목 | A idle | B drag | C zoom | D mixed |
| --- | ---: | ---: | ---: | ---: |
| `getBoundingClientRect` | 0 | 4,463 | 68 | 626 |
| 그중 marker host | 0 | 1,980 | 대부분 0 | 입력 구간에 따라 변동 |
| `ResizeObserver` callback | 0 | 0 | 0 | 3 |
| style/class attribute mutation | 4 | 소수 | 6,037 | 7,104 |
| app `focusMap` | 0 | 0 | 0 | 0 |

Drag의 geometry read 4,463회는 Trasolve의 `focusMap`이 아니라 Google Maps `AdvancedMarkerElement` 내부 marker host와 native child에서 발생했다. Zoom의 수천 건 mutation도 call stack상 Google Maps tile/viewport DOM이었다.

## 7. 원인 분리 실험

### 실험 1~3 — TripLayer / marker / polyline

같은 약 165 Hz profile에서 3회 반복한 zoom 중앙값이다.

| 표시 객체 | p95 ms | max ms | >16.7 | >33.3 | 결론 |
| --- | ---: | ---: | ---: | ---: | --- |
| TripLayer 없음 | 6.2 | 24.3 | 6 | 0 | 심한 drop 제거 |
| marker만 12개 | 6.2 | 30.2 | 4 | 0 | 없음과 사실상 동일 |
| polyline만 9개 | 12.2 | 103.1 | 19 | 8 | full 증상 재현 |
| full layer 대표 run | 12.1 | 115.2 | 18 | 5 | polyline-only와 같은 형태 |

60 Hz로 고정된 별도 fresh profile의 trace 비교도 같은 결과였다.

| 표시 객체 | 평균 ms | p95 ms | p99 ms | max ms | >25 | >50 | 최대 GPU task |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| TripLayer 없음 | 16.765 | 16.8 | 16.9 | 33.4 | 2 | 0 | 약 18.1 ms (`WaitForVSync` 중심) |
| marker만 | 16.765 | 16.8 | 17.1 | 33.9 | 2 | 0 | 22.6 ms |
| polyline만 | 17.945 | 16.9 | 50.1 | 116.6 | 9 | 3 | 120.9 ms raster |

Drag에서는 양상이 달랐다.

| 표시 객체 | p95 ms | max ms | `getBoundingClientRect` |
| --- | ---: | ---: | ---: |
| TripLayer 없음 | 6.2 | 11.9 | 503 |
| marker만 | 6.2 | 24.2 | 4,463 |
| polyline만 | 6.2 | 12.1 | 503 |
| full layer | 6.2 | 18.1 | 4,463 |

Marker가 drag 중 native geometry work를 약 3,960회 추가한 것은 사실이다. 다만 이 데이터 크기와 장비에서는 p95가 변하지 않았고 long frame도 재현하지 못했다. 따라서 marker는 drag 확장성 위험이지만 현재 줌 병목의 주원인은 아니다.

### 실험 4 — isZooming visibility 갱신 off

Visibility off 3회 zoom의 중앙값은 p95 12.1 ms, max 72.7 ms, `>16.7` 16회였다. full layer 반복 중앙값과 유의미한 차이가 없었다. 반면 marker를 계속 붙여 두어 `getBoundingClientRect`가 run당 3,614~5,088회로 늘었다. visibility effect가 `setVisible`을 요청해도 controller의 동일 값 guard 때문에 실제 attach/detach는 0회였다.

결론은 다음 두 가지다.

1. 현재 visibility 로직은 zoom 중 marker DOM 측정량을 확실히 줄인다.
2. 그럼에도 polyline-only에서 동일한 frame drop이 나므로 1차 병목을 해결하지 않는다.

Mixed 입력에서는 여러 `idle` 경계 때문에 marker 12개가 반복 attach/detach될 수 있다. 복귀 시 `.is-entering` opacity animation이 붙으므로 갑자기 튀어나오는 시각적 현상과 직접 연결된다.

### 실험 5 — camera subscription / focusMap off

- drag: p95 6.2 ms, max 12.1 ms
- zoom: p95 6.2 ms, max 42.4 ms

단일 max 차이는 zoom run variance 범위였다. 더 중요한 증거는 baseline interaction에서도 `focusMap`, 그 ResizeObserver callback, `fitBounds`, `setZoom`이 모두 0회였다는 점이다. 코드를 끈 실험은 실행되지 않던 코드를 제거했을 뿐이므로 병목이 아니다.

### 실험 6 — React map UI/chrome off

MapViewportChrome, search toolbar, AI panel, bottom controls, LayerPanel을 제거한 zoom 3회 중앙값은 p95 12.1 ms, max 84.8 ms, `>16.7` 9회였다. full layer의 p95와 max 분포를 벗어나는 개선이 없었다. Drag도 p95 6.2 ms, max 12.0 ms로 이미 빠른 baseline과 같았다.

이 판정은 “선택 카드가 닫힌 동일 화면 상태”에 해당한다. 열린 `AnchoredMapCard`는 자체 overlay draw와 rect read가 있으나 현재 코드는 zoom 중 이를 구독 해제한다. 선택 카드가 열린 별도 시나리오는 이번 고정 baseline 결과에 일반화하지 않는다.

### 추가 실험 — polyline symbol icon

방향 arrow와 station pattern을 모두 끈 뒤 같은 profile에서 바로 full icon을 다시 켠 paired trace는 다음과 같았다.

| 설정 | p95 ms | p99 ms | max ms | >50 | 최대 GPU task | Google `common.js ti` CPU 합계 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| symbol icon 없음 | 12.2 | 36.4 | 54.5 | 2 | 13.5 ms | 210.0 ms |
| full icon | 12.2 | 36.3 | 84.8 | 5 | 22.3 ms | 303.1 ms |

Icon이 CPU/GPU와 max를 증폭시키는 증거는 있으나, icon을 모두 꺼도 p95와 drop 횟수가 사라지지는 않았다. 2-point `Polyline` 자체 처리 비용도 남는다. Direction arrow와 station pattern 각각의 독립 기여도는 run variance 때문에 이번 데이터만으로 확정하지 않는다.

## 8. Chrome Performance long frame / call stack

### 선택한 long frame

| 구간 | duration | Scripting | Rendering / Paint | GPU | 실제 call stack과 시작점 |
| --- | ---: | --- | --- | --- | --- |
| Full zoom frame | rAF gap 151.4 ms | main `FunctionCall` max 10.634 ms, `FireAnimationFrame` max 10.944 ms | Layout max 0.701 ms, Paint max 1.293 ms, Commit max 2.365 ms | `GPUTask` 124.885 ms → `RendererRasterWorker` 124.857 ms → RasterDecoder `Flush` 121.670 ms | 앱 setter 없음. 지도에 붙어 있던 polyline을 Google zoom animator가 다시 그리는 과정 |
| Polyline-only zoom frame | rAF gap 116.6 ms | `FunctionCall` max 9.331 ms, Google `common.js ti` 누적 107.330 ms | Layout max 0.789 ms, Paint max 1.664 ms, Commit max 2.530 ms | `GPUTask` 120.931 ms → RasterWorker 120.918 ms → `Flush` 96.634 ms | `TripLayer`가 mount 때 생성한 9개 `google.maps.Polyline`; interaction setter 0회 |
| Mixed BeginMainFrame | 17.557 ms | `FireAnimationFrame` 8.412 ms, Google `map.js FunctionCall` 7.851 ms, `EventDispatch` 1.543 ms | Layerize 1.378 ms, Paint 0.991 ms | 같은 trace의 별도 GPU task max 39.410 ms | wheel/drag가 Google map animator를 시작. Trasolve 함수는 top stack에 없음 |
| Google viewport callback | 35.087 ms | `XHRReadyStateChange` 34.803 ms → `RunMicrotasks` 33.356 ms, Google viewport 처리 | 작은 layout/paint와 분리 | 별도 raster event | Google `GetViewportInfo` 응답 처리. TripLayer 없음에서도 27.979, 20.604, 19.838 ms가 남음 |

CPU profile 상 zoom의 상위 함수는 minified Google Maps `common.js ti`, `Pna`, controls update, `map.js Oya`, `setZIndex`, `poly.js release` 등이었다. Trasolve source 함수는 상위 stack에 나타나지 않았다.

중요한 점은 GPU event가 renderer main-thread event와 다른 thread/process에 있으므로 표의 시간을 단순 합산할 수 없다는 것이다. 그러나 `polyline-only`와 `marker-only/none` 사이에서 120 ms raster spike의 존재 여부가 일관되게 갈렸다.

기존 trace에서 관찰됐던 30~100 ms `FunctionCall` 자체는 이번 고정 입력에서는 재현되지 않았다. 고정 trace의 개별 main-thread FunctionCall 최대는 약 5.1~10.6 ms였다. 대신 긴 rAF gap은 GPU/raster spike와 Google viewport XHR microtask로 설명됐다. 따라서 확인되지 않은 30~100 ms FunctionCall을 Trasolve 함수로 추정하지 않았다.

### Trace aggregate 비교

같은 fresh 60 Hz profile의 zoom trace에서:

| 항목 | TripLayer 없음 | Polyline-only |
| --- | ---: | ---: |
| FunctionCall total / max | 572.090 / 9.321 ms | 834.550 / 9.331 ms |
| FireAnimationFrame total / max | 472.520 / 11.875 ms | 670.888 / 11.129 ms |
| UpdateLayout total / max | 85.065 / 1.156 ms | 104.144 / 1.813 ms |
| Layout total / max | 62.883 / 2.003 ms | 66.317 / 0.789 ms |
| Paint total / max | 57.290 / 0.946 ms | 98.845 / 1.664 ms |
| Commit total / max | 96.142 / 1.371 ms | 125.476 / 2.530 ms |

Polyline이 scripting, paint, commit, GPU raster 총량을 모두 늘리지만, 개별 Layout은 작다.

## 9. 강제 레이아웃 판정

고정 A~D trace에서 Chrome의 forced reflow 경고와 Trasolve call stack에 연결된 강제 synchronous layout은 발견되지 않았다.

- `focusMap`의 `getBoundingClientRect` 직전 DOM write: interaction 중 `focusMap` 자체가 0회
- `ResizeObserver → requestAnimationFrame → rect read`: interaction 중 focus observer 0회
- 동일 프레임 app DOM write → app DOM read 반복: 발견하지 못함
- Layout max: 대표 trace 0.459~0.915 ms, 격리 trace에서도 대부분 2.003 ms 이하
- Paint max: 대표 trace 0.559~1.692 ms

Drag에서 많은 rect read는 Google AdvancedMarker 내부였고, 그럼에도 Layout max와 frame p95가 낮았다. Zoom의 수천 attribute mutation 역시 Google Maps 내부 tile/viewport 업데이트였으며, 사용자 코드의 layout thrash 증거는 아니다.

## 10. 원인별 기여도와 최종 판정

### Primary bottleneck

**Google Maps 내부에서 Trasolve polyline layer를 zoom frame마다 투영·paint·rasterize하는 비용**

Evidence:

- TripLayer off: zoom p95 6.2 ms, max 중앙값 24.3 ms
- Marker only: p95 6.2 ms, max 중앙값 30.2 ms
- Polyline only: p95 12.2 ms, max 중앙값 103.1 ms, `>33.3` 중앙값 8회
- 동일 60 Hz trace: none/marker max 약 33 ms, polyline-only max 116.6 ms 및 120.9 ms GPU raster
- Polyline interaction setter: 전부 0회
- Polyline은 9개, 각각 2-point path이므로 path point 폭증이 원인이 아님
- 반복 symbol icon 제거 시 일부 개선되지만 drop이 완전히 사라지지 않음

이 원인은 분류 B의 “불필요한 setter 동기화”가 아니라, **정적인 Trasolve 객체를 Google Maps가 렌더하는 비용**이다.

### Secondary bottleneck

**Google Maps 기본 viewport/tile 처리 비용**

- TripLayer off에서도 Google `GetViewportInfo` XHR/microtask 19.8~28.0 ms가 관찰됨
- 사용자 callback 없이도 Google map animator, controls update, raster/GPU 작업이 남음
- 다만 TripLayer off에서는 심한 rAF/GPU spike가 거의 사라지므로 1차 원인은 아님

### Secondary risk, 현재 주 병목 아님

**AdvancedMarker drag geometry work와 zoom visibility 전환**

- marker로 인해 drag rect read가 503 → 4,463회 증가
- 그러나 drag p95는 6.2 ms로 동일
- marker-only zoom은 layer-none과 같은 수준
- mixed의 `idle` 3회에서 `setVisible` attach/detach가 72회 발생
- marker 복귀 시 opacity 진입 animation이 있어 “확 튐”을 설명함

### Not a bottleneck in the measured state

- React `GoogleMap`/`TripLayer` render: drag 0회, zoom은 `isZooming` transition 때만 발생하며 기존 Profiler도 0.4~1.0 ms 수준
- 전체 Trip sync: interaction 중 0회
- marker position/icon/color/selection/z-index setter: interaction 중 0회
- polyline path/style/visibility/z-index setter: interaction 중 0회
- focus/fitBounds/setZoom/ResizeObserver: interaction 중 0회
- Context `adapter`/`objects`/`canvasRef` reference churn: 없음
- 정적인 React map UI: 제거 전후 p95 차이 없음
- forced reflow / Layout / Paint: 큰 작업과 사용자 call stack 없음

### 판정 코드

- A 단독: 불충족. TripLayer를 제거하면 심한 drop이 사라지므로 Google 기본 지도만의 문제는 아니다.
- B: 불충족. object setter 반복이 없고 setter를 막는 것이 핵심 변화가 아니었다.
- C: 불충족. camera event → trip/context → 전체 object update 순환이 없다.
- D: 불충족. 기본 화면의 UI 제거와 layout trace에서 주 병목 증거가 없다.
- **E: 해당. Trasolve polyline 객체 구성과 Google Maps 내부 renderer/GPU 비용이 결합한다.**

## 11. 이후 최적화 우선순위

원인 조사 단계에서는 아래 최적화를 구현하지 않았다. 후속 구현 및 검증 결과는 13절에 별도로 기록한다. 다음 작업도 한 항목씩 별도 A/B trace로 검증하는 순서가 안전하다.

1. **Polyline zoom 정책부터 실험**: zoom 중 비선택 polyline을 잠시 detach하거나 단순화하고, `idle` 후 한 번만 복원한다. marker가 아니라 polyline을 대상으로 같은 none/only trace를 반복한다.
2. **Polyline symbol 비용 분해**: base stroke, direction arrow, station pattern을 각각 독립 flag로 비교한다. symbol repeat 수와 scale을 줄이거나 zoom 중 icon만 제거하는 후보를 측정한다.
3. **표현 방식 비교**: 동일 9개 선을 하나의 단순 overlay/canvas/WebGL 계층 또는 더 적은 Google object로 표현했을 때 raster와 p95가 줄어드는지 확인한다.
4. **zoom lifecycle 안정화**: 짧은 `idle`에 바로 marker를 복원하지 않도록 debounce/settle 기준을 검토한다. marker의 `.is-entering` animation을 zoom 복귀와 일반 신규 추가에서 분리해 “확 튐”을 없앤다.
5. **marker drag 비용은 후순위로 확장성 측정**: marker 수를 50/100/200개로 늘린 실제 데이터에서 rect read와 p95가 비선형으로 커지는지 확인한다.
6. **Google 기본 지도 비용은 마지막에 환경 교차검증**: visible Chrome, 60/120/165 Hz, AMD/NVIDIA renderer, production build에서 polyline 변경 전후를 비교한다.

성공 기준은 평균만 보지 않고 동일 입력의 p95, p99, max, `>16.7`/`>33.3`/`>50` 횟수와 GPU raster max가 함께 내려가는 것이다.

## 12. 조사 한계

- 자동화된 고정 입력은 reproducibility를 위한 개발용 실행이었으며 저장소에 테스트/fixture로 남기지 않았다.
- headless Chrome이었지만 hardware acceleration은 AMD ANGLE D3D11로 활성화되어 있었다. 실제 사용자 visible Chrome에서도 최종 패치 전후 재검증이 필요하다.
- 새 Chrome profile의 refresh cadence가 달라질 수 있어 cadence가 다른 run의 절대 평균을 직접 비교하지 않았다.
- max는 큰 편차가 있어 3회 중앙값과 trace call stack을 우선했다.
- 선택된 상세 카드가 열린 상태는 이번 고정 baseline 범위가 아니다. 기본 상태의 map UI/chrome 제거 실험과 forced layout 검사는 완료했다.

## 13. 후속 최적화 적용 및 검증

원인 분석 후 `TripLayer`의 polyline visibility 정책을 marker 정책과 동일하게 변경했다.

- zoom 시작: 선택되지 않은 polyline은 `setVisible(false)`로 숨김
- zoom 중: 선택된 polyline만 유지
- `idle`: 원래 day visibility와 path 유효성에 따라 polyline을 한 번 복원
- 기존 `OwnedPolyline.visible` 비교를 사용하므로 같은 값에는 setter를 호출하지 않음
- drag 및 Trip 전체 sync 경로는 변경하지 않음

같은 Chrome profile과 동일한 5초 wheel 입력으로 패치 전후를 각각 3회 실행했다. 아래 값은 3회 중앙값이다.

| 항목 | 패치 전 | 패치 후 | 변화 |
| --- | ---: | ---: | ---: |
| 평균 frame interval | 7.129 ms | 6.253 ms | -12.3% |
| p95 | 12.1 ms | 6.2 ms | -48.8% |
| p99 | 30.3 ms | 12.2 ms | -59.7% |
| max | 109.0 ms | 24.2 ms | -77.8% |
| `>16.7 ms` frame | 18회 | 3회 | -83.3% |
| `>33.3 ms` frame | 7회 | 0회 | 제거 |
| `>50 ms` frame | 4회 | 0회 | 제거 |

패치 후 3회 중 한 run에는 66.6 ms max outlier가 있었지만, 나머지는 18.2 ms와 24.2 ms였고 중앙값 기준으로 개선됐다. 패치 전 3회 max는 90.9, 109.0, 139.4 ms였다. 이는 원인 분리 실험의 polyline 판정과 같은 방향이다.

마커가 다시 나타나는 시각적 현상을 없애기 위해 “marker는 zoom 중에도 계속 유지하고 polyline만 숨김” 조합도 별도로 3회 측정했다. 이 조합은 p95 12.1 ms, max 중앙값 127.3 ms, `>16.7 ms` 중앙값 18회로 성능 개선이 유지되지 않아 채택하지 않았다. 따라서 이번 패치는 검증된 marker 숨김 정책을 유지한다. marker 복귀 연출 변경은 성능 정책과 분리해 후속 UX 작업으로 다뤄야 한다.
