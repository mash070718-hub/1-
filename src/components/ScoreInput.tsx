import { useId, useLayoutEffect, useRef, useState } from 'react';

function parseScore(text: string, max: number): { score: number | null; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { score: null, error: '' };
  const score = Number(trimmed);
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) || !Number.isFinite(score) || score < 0 || score > max) {
    return { score: null, error: `0~${max}점 범위의 숫자를 입력해 주세요. 소수점도 사용할 수 있습니다.` };
  }
  return { score, error: '' };
}

export default function ScoreInput({ label, value, onChange, max = 100 }: {
  label: string; value: number | null | undefined; onChange: (score: number | null) => void; max?: number;
}) {
  // Keep the actual text while typing (e.g. "18.") instead of replacing it with
  // its numeric value. A plain text field also avoids numeric controls changing IME mode.
  const [text, setText] = useState(() => value == null ? '' : String(value));
  const [composing, setComposing] = useState(false);
  const lastValue = useRef(value);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const { error } = parseScore(text, max);
  useLayoutEffect(() => {
    if (!Object.is(value, lastValue.current)) {
      lastValue.current = value;
      setText(value == null ? '' : String(value));
    }
  }, [value]);
  useLayoutEffect(() => {
    input.current?.setCustomValidity(composing ? '입력을 마친 뒤 저장해 주세요.' : error);
  }, [composing, error]);
  const update = (next: string, isComposing: boolean) => {
    setText(next);
    if (isComposing) return;
    const parsed = parseScore(next, max);
    if (parsed.error) return;
    lastValue.current = parsed.score;
    onChange(parsed.score);
  };
  return <label className="form-field"><span className="field-label">{label} <span> / {max}점</span></span>
    <input ref={input} className="input" aria-label={label} type="text" lang="ko" inputMode="text" autoComplete="off" spellCheck={false}
      aria-invalid={!composing && Boolean(error)} aria-describedby={`${id}-help${!composing && error ? ` ${id}-error` : ''}`}
      value={text} onChange={(event) => update(event.currentTarget.value, composing || (event.nativeEvent as InputEvent).isComposing)}
      onCompositionStart={() => setComposing(true)}
      onCompositionEnd={(event) => { setComposing(false); update(event.currentTarget.value, false); }} />
    <span id={`${id}-help`} className="field-help">0~{max}점 · 소수점 허용 · 비우면 미입력. 티어는 직접 지정합니다.</span>
    {!composing && error && <span id={`${id}-error`} className="field-help" role="alert">{error}</span>}
  </label>;
}
