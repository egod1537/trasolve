import { API_ROUTES, healthResponseSchema } from '@trasolve/shared';

const status = document.querySelector<HTMLParagraphElement>('#status')!;

async function checkHealth(): Promise<void> {
  try {
    const response = await fetch(API_ROUTES.health);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const body = healthResponseSchema.parse(await response.json());
    status.textContent = `API 연결 성공: ${body.status}`;
  } catch (error) {
    status.textContent = 'API 연결 실패. backend 실행 상태를 확인하세요.';
    console.error(error);
  }
}

void checkHealth();
