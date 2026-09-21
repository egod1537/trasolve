export const DEFAULT_JOB_BUILDER_LOCATIONS = [
  {
    id: 'test-seoul-station',
    placeId: 'ChIJlU6-zWiifDURBCDQ_VkAI7s',
    name: '서울역',
    address: '서울특별시 용산구 한강대로 405',
    location: { lat: 37.5540455, lng: 126.9708338 },
    openTime: '00:00',
    closeTime: '23:50',
    stayMinutes: 0,
  },
  {
    id: 'test-gyeongbokgung',
    placeId: 'ChIJod7tSseifDUR9hXHLFNGMIs',
    name: '경복궁',
    address: '서울특별시 종로구 사직로 161',
    location: { lat: 37.579617, lng: 126.977041 },
    openTime: '09:00',
    closeTime: '18:00',
    stayMinutes: 60,
  },
  {
    id: 'test-gangnam-station',
    placeId: 'ChIJKxs2jFmhfDURPP--kvKavw0',
    name: '강남역',
    address: '서울특별시 역삼동',
    location: { lat: 37.497952, lng: 127.027619 },
    openTime: '00:00',
    closeTime: '23:50',
    stayMinutes: 0,
  },
] as const;

export function createDefaultJobBuilderLocations() {
  return DEFAULT_JOB_BUILDER_LOCATIONS.map((location) => ({
    ...location,
    location: { ...location.location },
  }));
}
