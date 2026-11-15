import { buildInfo } from './buildInfo';

export function isDebugMode(search: string): boolean {
  return (
    buildInfo.channel !== 'production' &&
    new URLSearchParams(search).get('debug') === '1'
  );
}
