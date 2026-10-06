import { useState } from "react";
import { ArrowRight, BookMarked, FileText, Layers3, Sparkles, Swords } from "lucide-react";
import { getCatalogRecord } from "../lib/catalog";
import type { LibraryEntry, MirrorDeck, MirrorEvaluation } from "../lib/library";
import "./mirror-evaluation.css";

export interface MirrorEvaluationDetailsProps {
  entry: LibraryEntry;
  evaluation: MirrorEvaluation;
  entries: LibraryEntry[];
  decks: MirrorDeck[];
  onOpenDeck: (id: string) => void;
  onOpenEgo: (id: string) => void;
}

const displayName = (entry: LibraryEntry) => {
  const catalog = getCatalogRecord(entry.id);
  return catalog ? `${catalog.name} ${catalog.sinner}` : `${entry.name} ${entry.sinner}`.trim();
};

export default function MirrorEvaluationDetails({ entry, evaluation, entries, decks, onOpenDeck, onOpenEgo }: MirrorEvaluationDetailsProps) {
  const catalog = getCatalogRecord(entry.id);
  const name = catalog?.name ?? entry.name;
  const sinner = catalog?.sinner ?? entry.sinner;
  const image = catalog?.image;
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const Icon = entry.kind === "ego" ? Sparkles : BookMarked;
  const entryById = new Map(entries.map((item) => [item.id, item]));
  const recommendedEgos = evaluation.recommendedEgoIds.flatMap((id) => {
    const ego = entryById.get(id);
    return ego?.kind === "ego" ? [ego] : [];
  });
  const unavailableEgoCount = evaluation.recommendedEgoIds.length - recommendedEgos.length;
  const compatibleDecks = decks.filter((deck) => entry.kind === "identity"
    ? deck.memberIds.includes(entry.id)
    : entry.kind === "ego" && deck.recommendedEgoIds.includes(entry.id));

  return (
    <div className="mirror-evaluation mirror-evaluation-details" data-entry-id={entry.id}>
      <div className="detail-heading">
        <span className="detail-art" data-kind={entry.kind}>
          {image && failedImage !== image ? (
            <img src={image} alt={`${sinner} ${name} 공식 게임 이미지`} decoding="async"
              onError={() => setFailedImage(image)} />
          ) : <span className="entry-art-placeholder"><Icon size={38} />{failedImage === image && image && <span>이미지 없음</span>}</span>}
        </span>
        <div className="detail-heading-copy">
          <span className="mirror-evaluation-kicker">MIRROR DUNGEON / {entry.kind === "ego" ? "E.G.O" : "IDENTITY"}</span>
          <h3 className="mirror-evaluation-name">{name}</h3>
          <p className="detail-meta">{sinner || "수감자 미지정"}</p>
          <p>{evaluation.subtitle || "거울던전 한 줄 소개를 기록해 주세요."}</p>
          {catalog && (
            <div className="catalog-detail-meta">
              <span className="badge">{catalog.rarity}</span>
              <span>출시 {catalog.releaseDate}</span>
              <a className="catalog-source" href={catalog.sourceUrl} target="_blank" rel="noreferrer">
                이름·이미지 출처 <ArrowRight size={12} />
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="mirror-evaluation-tier" data-tier={evaluation.tier} aria-label="거울던전 티어">
        <span>거울던전 티어</span>
        <strong>{evaluation.tier === "unrated" ? "미평가" : evaluation.tier}</strong>
      </div>

      <section className="detail-section" aria-label="거울던전 설명">
        <h3 className="detail-section-title"><FileText size={17} /> 거울던전 설명</h3>
        <p className={evaluation.description.trim() ? "prose" : "detail-empty"}>
          {evaluation.description.trim() ? evaluation.description : "거울던전 설명이 없습니다."}
        </p>
      </section>
      <div className="two-column">
        <section className="detail-section" aria-label="거울던전 장점">
          <h3 className="detail-section-title">거울던전 장점</h3>
          <p className={evaluation.strengths.trim() ? "prose" : "detail-empty"}>
            {evaluation.strengths.trim() ? evaluation.strengths : "거울던전 장점을 기록해 주세요."}
          </p>
        </section>
        <section className="detail-section" aria-label="거울던전 단점">
          <h3 className="detail-section-title">거울던전 단점</h3>
          <p className={evaluation.weaknesses.trim() ? "prose" : "detail-empty"}>
            {evaluation.weaknesses.trim() ? evaluation.weaknesses : "거울던전 단점을 기록해 주세요."}
          </p>
        </section>
      </div>
      <section className="detail-section" aria-label="거울던전 운용 방법">
        <h3 className="detail-section-title"><Swords size={17} /> 거울던전 운용 방법</h3>
        <p className={evaluation.operation.trim() ? "prose" : "detail-empty"}>
          {evaluation.operation.trim() ? evaluation.operation : "거울던전에서의 스킬과 자원 운용을 기록해 주세요."}
        </p>
      </section>

      {entry.kind === "identity" && (
        <section className="detail-section" aria-label="거울던전 추천 E.G.O">
          <h3 className="detail-section-title"><Sparkles size={17} /> 거울던전 추천 E.G.O</h3>
          {recommendedEgos.length > 0 ? (
            <div className="linked-list">
              {recommendedEgos.map((ego) => (
                <button className="linked-card" type="button" key={ego.id} onClick={() => onOpenEgo(ego.id)}>
                  <span><span className="mirror-evaluation-link-meta">E.G.O · {getCatalogRecord(ego.id)?.sinner ?? ego.sinner}</span>
                    <strong>{displayName(ego)}</strong></span>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
          ) : <p className="detail-empty">거울던전 추천 E.G.O가 없습니다.</p>}
          {unavailableEgoCount > 0 && <p className="field-help mirror-evaluation-unavailable">도감에서 찾을 수 없는 추천 {unavailableEgoCount}개는 보관 중입니다.</p>}
        </section>
      )}

      <section className="detail-section" aria-label="거울던전 사용 덱">
        <h3 className="detail-section-title"><Layers3 size={17} /> 거울던전 사용 덱</h3>
        {compatibleDecks.length > 0 ? (
          <div className="linked-list">
            {compatibleDecks.map((deck) => (
              <button className="linked-card" type="button" key={deck.id} onClick={() => onOpenDeck(deck.id)}>
                <span><span className="mirror-evaluation-link-meta">거울던전 덱 · {deck.tier === "unrated" ? "미평가" : `${deck.tier} 티어`}</span>
                  <strong>{deck.name}</strong>
                  {deck.formationCode && <span className="linked-formation">편성번호 <code>{deck.formationCode}</code></span>}
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        ) : <p className="detail-empty">{entry.kind === "ego" ? "이 E.G.O를 추천한 거울던전 덱이 없습니다." : "이 인격을 편성한 거울던전 덱이 없습니다."}</p>}
      </section>
    </div>
  );
}
