import type { TripInput } from '@trasolve/shared';

const places = [
  ['seoul-station', '서울역', 37.5540455, 126.9708338, true],
  ['ddp', '동대문디자인플라자', 37.5665256, 127.0092236, false],
  ['deoksugung', '덕수궁 대한문', 37.5658028, 126.9751461, false],
  ['ssamziegil', '인사동 쌈지길', 37.5743296, 126.9849281, false],
  ['myeongdong-cathedral', '명동성당', 37.563177, 126.987369, false],
  ['gwanghwamun', '광화문광장', 37.572389, 126.9769117, false],
  ['cheonggye', '청계광장', 37.5691642, 126.9786692, false],
  ['dongdaemun-station', '동대문역사문화공원역', 37.565637, 127.008972, true],
] as const;

export function createDemoExampleTrip(): TripInput {
  return {
    title: '서울 여행 · 경로 최적화 체험',
    days: [
      {
        id: 'demo-day',
        title: '서울 당일 여행',
        color: '#2563eb',
        places: places.map(([id, name, lat, lng, orderLocked], index) => ({
          id,
          name,
          location: { lat, lng },
          visitDurationMinutes: 45,
          orderLocked,
          order: index + 1,
        })),
        polylines: [],
        layerItems: places.map(([id]) => ({ type: 'place' as const, id })),
      },
    ],
  };
}
