export default function ScoreInput({ label, value, onChange, max = 100 }: {
  label: string; value: number | null | undefined; onChange: (score: number | null) => void; max?: number;
}) {
  return <label className="form-field"><span className="field-label">{label} <span> / {max}점</span></span>
    <input className="input" aria-label={label} type="number" min="0" max={max} step="any" inputMode="decimal"
      value={value ?? ''} onChange={(event) => onChange(event.currentTarget.value === '' ? null : event.currentTarget.valueAsNumber)} />
    <span className="field-help">0~{max}점 · 소수점 허용 · 비우면 미입력. 티어는 직접 지정합니다.</span>
    {value != null && (value < 0 || value > max) && <span className="field-help" role="alert">기존 입력값 {value}점은 보존되어 있습니다. 0~{max}점 범위로 확인해 입력해 주세요.</span>}
  </label>;
}
