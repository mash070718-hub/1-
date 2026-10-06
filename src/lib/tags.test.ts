import assert from 'node:assert/strict';
import test from 'node:test';
import { GAME_TAG_GROUPS, isGameTag, MAX_SELECTED_TAGS, toggleGameTag } from './tags';

test('game tag presets match the supplied game groups with only the two requested additions', () => {
  assert.deepEqual(GAME_TAG_GROUPS, [
    { id: 'type', label: '유형', tags: ['참격', '관통', '타격'] },
    { id: 'affinity', label: '속성', tags: ['분노', '색욕', '나태', '탐식', '우울', '오만', '질투'] },
    { id: 'keyword', label: '스킬키워드', tags: ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전'] },
    {
      id: 'other', label: '기타',
      tags: [
        '림버스 컴퍼니', '로보토미 본사', 'H사', 'N사', 'R사', 'T사', 'W사',
        '츠바이', '시', '생크', '리우', '세븐', '제바찌', '디에치',
        '외우피', '검계', '흑운회', '기술 해방 연합', '워더링 하이츠', '피쿼드호', '혈귀',
        '흑수', '손가락', '엄지', '검지', '중지', '약지', '소지',
        '거미집', 'LCE', 'E.G.O 장비', '탄환', '버림', '르루주', '르누아르',
      ],
    },
  ]);
  const tags = GAME_TAG_GROUPS.flatMap((group) => [...group.tags]);
  assert.equal(new Set(tags).size, tags.length);
  assert.ok(tags.every(isGameTag));
  assert.equal(isGameTag('개인 메모'), false);
  assert.equal(isGameTag('알 수 없는 태그'), false);
});

test('new selections stop at ten while preserving old custom tags and allowing deselection', () => {
  assert.equal(MAX_SELECTED_TAGS, 10);
  const selections = ['개인 메모', ...GAME_TAG_GROUPS[1].tags, '화상'];
  const tenSelections = toggleGameTag(selections, '출혈');
  assert.equal(tenSelections.length, 10);
  assert.deepEqual(toggleGameTag(tenSelections, '진동'), tenSelections);
  assert.deepEqual(toggleGameTag(tenSelections, '출혈'), selections);
  assert.ok(tenSelections.includes('개인 메모'));
  assert.equal(selections.length, 9);
});

test('existing selections above the limit are never truncated and can still be removed', () => {
  const legacy = Array.from({ length: 12 }, (_, index) => `기존 태그 ${index}`).concat('화상');
  assert.deepEqual(toggleGameTag(legacy, '출혈'), legacy);
  assert.deepEqual(toggleGameTag(legacy, '알 수 없는 태그'), legacy);
  assert.deepEqual(toggleGameTag(legacy, '화상'), legacy.slice(0, -1));
  assert.equal(legacy.length, 13);
});
