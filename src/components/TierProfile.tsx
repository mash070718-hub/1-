import type { ReactNode } from 'react';
import './tier-profile.css';

/** An omitted score is for E.G.O.; null is an identity with no score yet. */
export default function TierProfile({ label, score, scoreLabel, scoreNote, children, onClick }: {
  label: string;
  score?: number | null;
  scoreLabel?: string;
  scoreNote?: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tier-profile"
      aria-label={label}
      aria-description={score === undefined ? undefined : [scoreLabel ?? (score === null ? '점수 미입력' : `${score}점`), scoreNote].filter(Boolean).join(' · ')}
      title={label}
      onClick={onClick}
    >
      {children}
      {score !== undefined && (
        <span className="tier-profile-score" data-missing={score === null}>
          {scoreLabel ?? (score === null ? '미입력' : `${score}점`)}
          {scoreNote && <small className="tier-profile-score-note">{scoreNote}</small>}
        </span>
      )}
    </button>
  );
}
