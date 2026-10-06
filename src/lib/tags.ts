export const MAX_SELECTED_TAGS = 10;

/** The game's tag groups, with the two requested personal additions in 기타. */
export const GAME_TAG_GROUPS = [
  {
    id: 'type',
    label: '유형',
    tags: ['참격', '관통', '타격'],
  },
  {
    id: 'affinity',
    label: '속성',
    tags: ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투'],
  },
  {
    id: 'keyword',
    label: '스킬키워드',
    tags: ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전'],
  },
  {
    id: 'other',
    label: '기타',
    tags: [
      '림버스 컴퍼니', '로보토미 본사', 'H사', 'N사', 'R사', 'T사', 'W사',
      '츠바이', '시', '생크', '리우', '세븐', '제바찌', '디에치',
      '외우피', '검계', '흑운회', '기술 해방 연합', '워더링 하이츠', '피쿼드호', '혈귀',
      '흑수', '손가락', '엄지', '검지', '중지', '약지', '소지',
      '거미집', 'LCE', 'E.G.O 장비', '탄환', '버림', '르루주', '르누아르',
    ],
  },
] as const;

const GAME_TAGS = new Set<string>(GAME_TAG_GROUPS.flatMap((group) => [...group.tags]));

export function isGameTag(tag: string): boolean {
  return GAME_TAGS.has(tag);
}

/** Keep older tags intact; only new selections are subject to the game's limit. */
export function toggleGameTag(tags: readonly string[], tag: string): string[] {
  if (!isGameTag(tag)) return [...tags];
  if (tags.includes(tag)) return tags.filter((selectedTag) => selectedTag !== tag);
  if (tags.length >= MAX_SELECTED_TAGS) return [...tags];
  return [...tags, tag];
}
