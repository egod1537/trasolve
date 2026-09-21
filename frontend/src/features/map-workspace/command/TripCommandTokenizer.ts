export type TripCommandTokenizeResult =
  { success: true; tokens: string[] } | { success: false; error: string };

export function tokenizeTripCommand(input: string): TripCommandTokenizeResult {
  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let escaping = false;
  let tokenStarted = false;

  for (const character of input) {
    if (escaping) {
      if (character !== '"' && character !== '\\') {
        return {
          success: false,
          error: `지원하지 않는 escape 문자열입니다: \\${character}`,
        };
      }
      current += character;
      escaping = false;
      tokenStarted = true;
      continue;
    }

    if (character === '\\') {
      escaping = true;
      tokenStarted = true;
      continue;
    }
    if (character === '"') {
      inQuotes = !inQuotes;
      tokenStarted = true;
      continue;
    }
    if (/\s/u.test(character) && !inQuotes) {
      if (tokenStarted) {
        tokens.push(current);
        current = '';
        tokenStarted = false;
      }
      continue;
    }
    current += character;
    tokenStarted = true;
  }

  if (escaping) {
    return {
      success: false,
      error: '문자열 끝의 escape 문자 뒤에 값이 없습니다.',
    };
  }
  if (inQuotes) {
    return { success: false, error: '닫히지 않은 큰따옴표가 있습니다.' };
  }
  if (tokenStarted) {
    tokens.push(current);
  }
  return { success: true, tokens };
}
