import '../../styles/map-user-controls.css';

function NineDotIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {[5, 12, 19].flatMap((cy) =>
        [5, 12, 19].map((cx) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.35" />
        )),
      )}
    </svg>
  );
}

export function MapUserControls() {
  return (
    <div className="map-user-controls" role="group" aria-label="사용자 메뉴">
      <button
        type="button"
        className="map-app-menu-button"
        aria-label="메뉴"
        title="메뉴"
      >
        <NineDotIcon />
      </button>
      <button
        type="button"
        className="map-profile-button"
        aria-label="성준 프로필"
        title="프로필"
      >
        성준
      </button>
    </div>
  );
}
