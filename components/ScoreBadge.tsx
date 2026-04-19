import { ScoredWeatherHour } from "@/lib/types";

const STYLE_MAP: Record<ScoredWeatherHour["scoreLabel"], string> = {
  good: "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40",
  ok: "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40",
  bad: "bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/40"
};

export function ScoreBadge({ label, score }: { label: ScoredWeatherHour["scoreLabel"]; score: number }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STYLE_MAP[label]}`}>
      {score}
    </span>
  );
}
