import { useState } from "react";
import { ArrowRight, BookMarked, FileText, Layers3, Sparkles, Swords } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import type { LibraryEntry, MirrorDeck } from "../lib/library";
import MirrorPlanDetails from "./MirrorPlanDetails";
import "./mirror-dungeon.css";

export interface MirrorDeckDetailsProps {
  deck: MirrorDeck;
  entries: LibraryEntry[];
  onOpenIdentity: (id: string) => void;
  onOpenEgo: (id: string) => void;
}

const displayName = (entry: LibraryEntry) =>
  getCatalogRecord(entry.id) ? `${entry.name} ${entry.sinner}` : entry.name;

function MirrorIdentityArt({ entry, large = false }: { entry: LibraryEntry | undefined; large?: boolean }) {
  const record = entry ? getCatalogRecord(entry.id) : undefined;
  const image = large ? record?.image : record?.thumbnail;
  const [failedImage, setFailedImage] = useState<string | undefined>();
  return (
    <span className={large ? "mirror-deck-detail-cover" : "mirror-deck-member-art"}>
      {image && failedImage !== image ? (
        <img src={image} alt={entry ? `${entry.sinner} ${entry.name} 공식 게임 이미지` : ""} loading={large ? "eager" : "lazy"} decoding="async" onError={() => setFailedImage(image)} />
      ) : (
        <span className="mirror-deck-art-placeholder" aria-hidden="true"><BookMarked size={large ? 36 : 22} /></span>
      )}
    </span>
  );
}

export default function MirrorDeckDetails({ deck, entries, onOpenIdentity, onOpenEgo }: MirrorDeckDetailsProps) {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]));
  const cover = entryById.get(deck.memberIds[0]);
  return (
    <div className="mirror-deck-details">
      <div className="mirror-deck-heading">
        <MirrorIdentityArt entry={cover} large />
        <div className="mirror-deck-heading-copy">
          <p className="mirror-small-kicker">MIRROR DUNGEON / DECK</p>
          <h3>{deck.name}</h3>
          <p className="mirror-deck-meta">거울던전 · {deck.memberIds.length}명 편성{deck.affinity && ` · ${deck.affinity}`}</p>
          {deck.subtitle.trim() && <p className="mirror-deck-subtitle">{deck.subtitle}</p>}
          <div className="entry-tags">{deck.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
        </div>
      </div>

      <div className="mirror-deck-tier">
        <span>거울던전 티어</span>
        <strong data-tier={deck.tier}>{deck.tier === "unrated" ? "미평가" : `${deck.tier} 티어`}</strong>
      </div>

      <section className="detail-section">
        <h3 className="detail-section-title"><FileText size={17} /> 거울던전 설명</h3>
        <p className={deck.description.trim() ? "prose" : "detail-empty"}>{deck.description.trim() ? deck.description : "거울던전 설명을 기록해 주세요."}</p>
      </section>

      <section className="detail-section mirror-deck-formation">
        <h3 className="detail-section-title"><Layers3 size={17} /> 거울던전 편성</h3>
        {deck.memberIds.length > 0 ? (
          <ol className="mirror-deck-member-list" aria-label="거울던전 덱 편성 순서">
            {deck.memberIds.map((id, index) => {
              const member = entryById.get(id);
              return (
                <li key={id}>
                  <button type="button" onClick={() => onOpenIdentity(id)} disabled={!member} aria-label={`${member ? displayName(member) : "연결된 인격"} 거울던전 인격 기록 보기`}>
                    <span className="mirror-deck-member-number">{index + 1}</span>
                    <MirrorIdentityArt entry={member} />
                    <span className="mirror-deck-member-name"><strong>{member ? displayName(member) : "연결된 인격을 찾을 수 없습니다"}</strong>{index === 0 && <small>덱 표지</small>}</span>
                    <ArrowRight size={15} />
                  </button>
                </li>
              );
            })}
          </ol>
        ) : <p className="detail-empty">편성된 인격이 없습니다.</p>}
        {deck.formationCode.trim() && (
          <div className="mirror-deck-code">
            <h4>거울던전 편성번호</h4>
            <code>{deck.formationCode}</code>
          </div>
        )}
      </section>

      <MirrorPlanDetails plan={deck.plan} memberIds={deck.memberIds} entries={entries} />

      <div className="two-column">
        <section className="detail-section">
          <h3 className="detail-section-title">거울던전 장점</h3>
          <p className={deck.strengths.trim() ? "prose" : "detail-empty"}>{deck.strengths.trim() ? deck.strengths : "장점을 기록해 주세요."}</p>
        </section>
        <section className="detail-section">
          <h3 className="detail-section-title">거울던전 단점</h3>
          <p className={deck.weaknesses.trim() ? "prose" : "detail-empty"}>{deck.weaknesses.trim() ? deck.weaknesses : "단점을 기록해 주세요."}</p>
        </section>
      </div>
      <section className="detail-section">
        <h3 className="detail-section-title"><Swords size={17} /> 거울던전 운용 방법</h3>
        <p className={deck.operation.trim() ? "prose" : "detail-empty"}>{deck.operation.trim() ? deck.operation : "운용 방법을 기록해 주세요."}</p>
      </section>

      <section className="detail-section">
        <h3 className="detail-section-title"><Sparkles size={17} /> 거울던전 추천 E.G.O</h3>
        {deck.recommendedEgoIds.length > 0 ? (
          <div className="linked-list">
            {deck.recommendedEgoIds.map((id) => {
              const ego = entryById.get(id);
              return (
                <button type="button" className="linked-card" key={id} disabled={!ego} onClick={() => onOpenEgo(id)} aria-label={`${ego ? displayName(ego) : "연결된 E.G.O"} 거울던전 E.G.O 기록 보기`}>
                  <span>{ego ? displayName(ego) : "연결된 E.G.O를 찾을 수 없습니다"}</span>
                  <ArrowRight size={15} />
                </button>
              );
            })}
          </div>
        ) : <p className="detail-empty">거울던전에서 추천할 E.G.O를 연결해 주세요.</p>}
      </section>
    </div>
  );
}
