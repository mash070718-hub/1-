import type { ReactNode } from 'react';
import './tier-profile.css';

/** An omitted score is for E.G.O.; null is an identity with no score yet. */
export default function TierProfile({ label, score, children, onClick }: {
  label: string;
  score?: number | null;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="tier-profile"
      aria-label={label}
      aria-description={score === undefined ? undefined : score === null ? '점수 미입력' : `${score}점`}
      title={label}
      onClick={onClick}
    >
      {children}
      {score !== undefined && (
        <span className="tier-profile-score" data-missing={score === null}>
          {score === null ? '미입력' : `${score}점`}
        </span>
      )}
    </button>
  );
}
