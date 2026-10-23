import { useId } from 'react';
import { getArtworkChoice, getCatalogRecord, type IdentityArtwork } from '../lib/catalog';
import type { LibraryEntry } from '../lib/library';
import './identity-artwork.css';

export default function IdentityArtworkPicker({ entry, onChange }: {
  entry: LibraryEntry;
  onChange: (artwork: IdentityArtwork) => void;
}) {
  const group = useId();
  const record = getCatalogRecord(entry.id);
  if (entry.kind !== 'identity' || !record?.artworks) return null;
  const selected = getArtworkChoice(entry);
  const sameArt = record.artworks.uptie1.image === record.artworks.uptie3.image;
  return <fieldset className="identity-artwork-picker field-wide">
    <legend className="field-label">인격 일러스트</legend>
    <div className="identity-artwork-options">
      {(['uptie1', 'uptie3'] as const).map((choice) => {
        const label = choice === 'uptie1' ? '1동기화 일러스트' : '3동기화 일러스트';
        return <label className="identity-artwork-option" data-selected={selected === choice} key={choice}>
          <img src={record.artworks![choice].thumbnail} alt="" decoding="async" />
          <span><input type="radio" name={group} value={choice} checked={selected === choice} onChange={() => onChange(choice)} />{label}</span>
        </label>;
      })}
    </div>
    <p className="field-help">목록·티어표·거울던전과 이 인격이 1번인 덱 표지에 함께 적용됩니다. 기록 저장 후 게시하면 방문자에게도 반영됩니다.</p>
    {sameArt && <p className="field-help">이 기본 인격은 별도의 3동기화 일러스트가 없어 같은 이미지가 표시됩니다.</p>}
  </fieldset>;
}
