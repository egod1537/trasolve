import type { TripInput, TripPlace } from '@trasolve/shared';

type DemoPlace = Omit<TripPlace, 'order'>;

const places: readonly DemoPlace[] = [
  {
    id: 'seoul-station',
    placeId: 'ChIJlU6-zWiifDURBCDQ_VkAI7s',
    name: '서울역',
    location: { lat: 37.5540455, lng: 126.9708338 },
    visitDurationMinutes: 30,
    orderLocked: true,
  },
  {
    id: 'hongdae',
    placeId: 'ChIJ4d9T2emYfDURGK_RrkTeN0o',
    name: '홍대입구',
    location: { lat: 37.557527, lng: 126.9244669 },
    visitDurationMinutes: 60,
  },
  {
    id: 'myeongdong',
    placeId: 'ChIJ_du5f_qifDURo58Y4M0dDfY',
    name: '명동',
    location: { lat: 37.560918, lng: 126.985865 },
    visitDurationMinutes: 60,
  },
  {
    id: 'mangwon-hangang-park',
    placeId: 'ChIJkfry2i-ZfDURdkxPeBp8x7Q',
    name: '망원한강공원',
    location: { lat: 37.5527919, lng: 126.8985613 },
    visitDurationMinutes: 60,
  },
  {
    id: 'gyeongbokgung',
    placeId: 'ChIJod7tSseifDUR9hXHLFNGMIs',
    name: '경복궁',
    location: { lat: 37.579617, lng: 126.977041 },
    visitDurationMinutes: 90,
  },
  {
    id: 'yeouido',
    placeId: 'ChIJkyjFLRaffDUR83w6PTvM0_c',
    name: '여의도',
    location: { lat: 37.52064, lng: 126.924838 },
    visitDurationMinutes: 60,
  },
  {
    id: 'n-seoul-tower',
    placeId: 'ChIJqWqOqFeifDURpYJ5LnxX-Fw',
    name: 'N서울타워',
    location: { lat: 37.5511694, lng: 126.9882266 },
    visitDurationMinutes: 60,
  },
  {
    id: 'namdaemun-market',
    placeId: 'ChIJfYjlFvWifDURYSDsoxYbN80',
    name: '남대문시장',
    location: { lat: 37.559277, lng: 126.9777029 },
    visitDurationMinutes: 60,
    orderLocked: true,
  },
];

function createDemoDay(): TripInput['days'][number] {
  const orderedPlaces = places.map((place, index) => ({
    ...place,
    location: { ...place.location },
    order: index + 1,
  }));
  const polylines = orderedPlaces.slice(0, -1).map((place, index) => ({
    id: `demo-route-${index + 1}`,
    fromPlaceId: place.id,
    toPlaceId: orderedPlaces[index + 1]!.id,
    mode: 'transit' as const,
    order: index + 1,
  }));
  return {
    id: 'demo-day',
    title: '경로 최적화 예제',
    color: '#2563eb',
    places: orderedPlaces,
    polylines,
    layerItems: orderedPlaces.flatMap((place, index) => [
      { type: 'place' as const, id: place.id },
      ...(polylines[index]
        ? [{ type: 'polyline' as const, id: polylines[index].id }]
        : []),
    ]),
  };
}

export function createDemoExampleTrip(): TripInput {
  return createDemoStarterTrip('서울 여행 · 경로 최적화 체험');
}

export function createDemoStarterTrip(title: string): TripInput {
  return { title, days: [createDemoDay()] };
}
