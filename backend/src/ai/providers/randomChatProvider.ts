import { setTimeout as delay } from 'node:timers/promises';
import type { ChatRequest, ChatResponse } from '@trasolve/shared';
import type { ChatProvider } from '../chatProvider.js';

// Default development/runtime provider. It does not change map or itinerary state.
export class RandomChatProvider implements ChatProvider {
  public async chat(_request: ChatRequest): Promise<ChatResponse> {
    const delayMs = 500 + Math.floor(Math.random() * 2501);
    await delay(delayMs);
    const index = Math.floor(
      Math.random() * RandomChatProvider.responses.length,
    );
    return {
      message: {
        role: 'assistant',
        content: RandomChatProvider.responses[index],
      },
    };
  }

  private static readonly responses = [
    '일정 사이에 여유 시간을 두면 더 편안하게 여행할 수 있어요.',
    '이동 시간을 고려하면 방문 순서를 바꾸는 게 좋아 보여요.',
    [
      '### 도쿄 하루 일정 제안',
      '',
      '**가까운 장소끼리** 묶고, *여유 시간*을 남겨보세요.',
      '',
      '- 오전: 아사쿠사 산책',
      '- 오후: 우에노 공원',
      '- 저녁: 시부야 주변 둘러보기',
      '',
      '> 실제 이동 시간과 운영 시간은 출발 전에 확인해 주세요.',
      '',
      '---',
      '',
      '1. 꼭 방문할 장소를 먼저 정해요.',
      '2. ~~빈틈없이 채우기~~ 대신 쉬는 시간을 넣어요.',
      '',
      '[도쿄 관광 정보](https://www.gotokyo.org/kr/)도 참고해 보세요.',
    ].join('\n'),
    '주변 장소를 함께 묶으면 이동 시간을 줄일 수 있어요.',
    [
      '### 일정 메모 예시',
      '',
      '| 시간대 | 장소 | 활동 |',
      '| --- | --- | --- |',
      '| 오전 | 아사쿠사 | 산책 |',
      '| 오후 | 우에노 | 공원과 카페 |',
      '| 저녁 | 시부야 | 식사 |',
      '',
      '메모를 정리할 때는 `장소`, `시간대`, `활동`을 함께 기록해 보세요.',
      '',
      '```json',
      '{',
      '  "place": "시부야",',
      '  "time": "저녁",',
      '  "activity": "식사"',
      '}',
      '```',
    ].join('\n'),
  ] as const;
}
