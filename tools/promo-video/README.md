# Trasolve 75초 소개 영상 v5

Python 3, Pillow, NumPy, FFmpeg, Noto Sans CJK TTC가 필요합니다.

```sh
python -m pip install -r requirements.txt
python render_v5.py --preview
python render_v5.py
```

영상은 `Trasolve_75s_v5.mp4`에 저장됩니다. 환경 변수 `TRASOLVE_FONT_REGULAR`, `TRASOLVE_FONT_BOLD`로 폰트 경로를 지정할 수 있습니다. `TRASOLVE_FONT_INDEX`(기본값 1)로 TTC 인덱스를 변경할 수 있습니다. Windows/macOS에서는 설치된 폰트 경로를 지정하세요.

서비스의 npm 빌드와 독립적으로 실행됩니다. 최종 MP4와 `work/`의 렌더링 결과는 Git에서 제외합니다. 원본 캡처의 지도 출처 표시는 유지하세요.

## v5 변경 사항
- 도입부에 Google 지도·네이버 지도의 구간 길찾기와 여행 조건을 고려한 방문 순서 계산의 차이를 명시.
- 하단 진행 바와 우측 상단 페이지 번호, 제작용 보조 문구 제거.
- 75초 타임라인, 음악, 실제 캡처 및 디버그 수치 가림 유지.

## 사용 자료
- assets/image1~6.jpg: 기존 35초 콘티 문서에서 가져온 실제 서비스 캡처이며, 새 빌드의 녹화본은 아닙니다.
- 지도 그래픽, 카드 애니메이션과 AI 일정 편집 흐름은 연출용으로 생성합니다. AI 편집 동작은 이번 영상에서 새로 검증하지 않았습니다.
- 원본 로고 대신 서비스명 타이포그래피를 사용합니다.
