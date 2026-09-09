import { useState } from 'react';
import '../../styles/map-toolbar.css';

type MapTool = 'pan' | 'marker' | 'polyline' | 'route' | 'measure';

const tools: { id: MapTool; label: string; path: string }[] = [
  {
    id: 'pan',
    label: '지도 이동 도구',
    path: 'M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 4-3 6-7 6-2 0-4-1-5-3l-5-6a2 2 0 0 1 3-2l2 2Z',
  },
  {
    id: 'marker',
    label: '마커 추가 도구',
    path: 'M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0ZM14 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  },
  {
    id: 'polyline',
    label: '장소 연결 도구',
    path: 'm5 17 6-10 8 10M3 17h4v4H3zM9 3h4v4H9zM17 17h4v4h-4z',
  },
  { id: 'route', label: '경로 도구', path: 'M5 20V9h13M14 5l4 4-4 4M3 20h4' },
  {
    id: 'measure',
    label: '거리 측정 도구',
    path: 'm3 16 13-13 5 5L8 21ZM6 13l2 2m1-5 3 3m0-6 2 2m1-5 3 3',
  },
];

function Icon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

export function MapToolbar({ aiOpen }: { aiOpen: boolean }) {
  const [query, setQuery] = useState('');
  const [activeTool, setActiveTool] = useState<MapTool>('pan');
  const [searchNotice, setSearchNotice] = useState('');

  return (
    <div className="map-toolbar-positioner" data-ai-open={aiOpen}>
      <div className="map-toolbar" role="group" aria-label="지도 검색 및 도구">
        <form
          className="map-toolbar-search"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchNotice('장소 검색 기능은 준비 중입니다.');
          }}
        >
          <input
            type="search"
            aria-label="장소 검색"
            placeholder="장소 검색"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearchNotice('');
            }}
          />
          <button type="submit" aria-label="검색" title="검색 (준비 중)">
            <Icon path="M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6" />
          </button>
        </form>
        <div
          className="map-toolbar-tools"
          role="group"
          aria-label="지도 도구 선택 (미리보기)"
        >
          <button
            type="button"
            disabled
            aria-label="실행 취소"
            title="실행 취소 (아직 지원되지 않음)"
          >
            <Icon path="m9 4-5 5 5 5M4 9h10a6 6 0 0 1 0 12" />
          </button>
          <button
            type="button"
            disabled
            aria-label="다시 실행"
            title="다시 실행 (아직 지원되지 않음)"
          >
            <Icon path="m15 4 5 5-5 5M20 9H10a6 6 0 0 0 0 12" />
          </button>
          {tools.map(({ id, label, path }) => (
            <button
              key={id}
              type="button"
              title={`${label} (선택 미리보기)`}
              aria-label={label}
              aria-pressed={activeTool === id}
              className={activeTool === id ? 'is-active' : undefined}
              onClick={() => setActiveTool(id)}
            >
              <Icon path={path} />
            </button>
          ))}
        </div>
        <div className="map-toolbar-notice" role="status">
          {searchNotice}
        </div>
      </div>
    </div>
  );
}
