import { ScoreLabel } from "@/lib/types";

interface ScoreBadgeProps {
  label: ScoreLabel;
  score: number;
  className?: string;
}

interface ScoreBadgeVisual {
  icon: string;
  text: string;
  className: string;
}

const VISUAL_MAP: Record<ScoreLabel, ScoreBadgeVisual> = {
  good: {
    icon: "🟢",
    text: "Bra",
    className: "bg-emerald-950 text-emerald-100 ring-1 ring-emerald-400/60"
  },
  ok: {
    icon: "🟡",
    text: "OK",
    className: "bg-amber-950 text-amber-100 ring-1 ring-amber-400/60"
  },
  bad: {
    icon: "🔴",
    text: "Dårlig",
    className: "bg-rose-950 text-rose-100 ring-1 ring-rose-400/60"
  }
};

/**
 * Visuell guide for konsistent score-badge:
 * - Rekkefølge: ikon -> nivåtekst -> poeng (0-100)
 * - Samme semantikk overalt: Bra (grønn), OK (gul), Dårlig (rød)
 * - Bruk alltid aria-label med både nivåtekst og poengsum
 */
export function ScoreBadge({ label, score, className = "" }: ScoreBadgeProps) {
  const visual = VISUAL_MAP[label];
  const ariaLabel = `Score ${score} av 100, nivå ${visual.text}`;

  return (
    <span
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${visual.className} ${className}`.trim()}
    >
      <span aria-hidden="true" className="text-xs leading-none">
        {visual.icon}
      </span>
      <span>{visual.text}</span>
      <span className="text-xs font-bold tabular-nums text-current/90">{score}</span>
    </span>
  );
}
