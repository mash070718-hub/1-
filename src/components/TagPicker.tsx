import { GAME_TAG_GROUPS, isGameTag, MAX_SELECTED_TAGS, toggleGameTag } from '../lib/tags';
import './tag-picker.css';

type TagPickerProps = {
  value: string[];
  onChange: (tags: string[]) => void;
};

export function TagPicker({ value, onChange }: TagPickerProps) {
  const atLimit = value.length >= MAX_SELECTED_TAGS;
  const existingTags = value.filter((tag) => !isGameTag(tag));

  return (
    <section className="game-tag-picker" aria-label="게임 태그 선택">
      <div className="game-tag-picker-heading">
        <span className="game-tag-picker-title">태그</span>
        <span className="game-tag-picker-count" aria-live="polite">
          선택 {value.length} / 최대 {MAX_SELECTED_TAGS}개
        </span>
      </div>
      {GAME_TAG_GROUPS.map((group) => (
        <fieldset className="game-tag-group" key={group.id}>
          <legend>{group.label}</legend>
          <div className="game-tag-options">
            {group.tags.map((tag) => {
              const selected = value.includes(tag);
              return (
                <button
                  type="button"
                  className="game-tag-option"
                  key={tag}
                  aria-pressed={selected}
                  disabled={atLimit && !selected}
                  onClick={() => onChange(toggleGameTag(value, tag))}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {existingTags.length > 0 && (
        <fieldset className="game-tag-group game-tag-group-existing">
          <legend>기존 태그</legend>
          <div className="game-tag-options">
            {existingTags.map((tag, index) => (
              <button
                type="button"
                className="game-tag-option"
                key={`${tag}-${index}`}
                aria-pressed="true"
                title="누르면 이 태그를 해제합니다"
                onClick={() => onChange(value.filter((selectedTag) => selectedTag !== tag))}
              >
                {tag}
              </button>
            ))}
          </div>
          <p className="game-tag-existing-help">이전에 저장한 태그입니다. 그대로 보관하거나 눌러서 해제할 수 있습니다.</p>
        </fieldset>
      )}
      <p className="game-tag-help">
        {value.length > MAX_SELECTED_TAGS
          ? `기존 ${value.length}개 태그를 보존했습니다. 새 태그를 추가하려면 ${MAX_SELECTED_TAGS}개 미만으로 줄여 주세요.`
          : '태그는 최대 10개까지 선택할 수 있습니다. 선택한 태그를 다시 누르면 해제됩니다.'}
      </p>
    </section>
  );
}
