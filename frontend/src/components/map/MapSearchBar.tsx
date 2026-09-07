export function MapSearchBar() {
  return (
    <div className="trip-map-search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <label className="sr-only" htmlFor="map-search">
        장소 검색 (준비 중)
      </label>
      <input
        id="map-search"
        type="search"
        placeholder="장소 검색"
        disabled
        aria-describedby="map-search-note"
      />
      <span id="map-search-note">준비 중</span>
    </div>
  );
}
