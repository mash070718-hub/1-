export default function ScoreInput({ label, value, onChange }: {
  label: string; value: number | null | undefined; onChange: (score: number | null) => void;
}) {
  return <label className="form-field"><span className="field-label">{label}</span>
    <input className="input" aria-label={label} type="number" min="0" max="100" step="any" inputMode="decimal"
      value={value ?? ''} onChange={(event) => onChange(event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber)} />
    <span className="field-help">0~100점 · 소수점 허용 · 비우면 미입력. 티어는 직접 지정합니다.</span>
  </label>;
}
