import { ScoredWeatherHour } from "@/lib/types";

const STYLE_MAP: Record<ScoredWeatherHour["scoreLabel"], string> = {
  good: "bg-green-100 text-green-800",
  ok: "bg-amber-100 text-amber-800",
  bad: "bg-red-100 text-red-800"
};

export function ScoreBadge({ label, score }: { label: ScoredWeatherHour["scoreLabel"]; score: number }) {
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STYLE_MAP[label]}`}>
      {score}
    </span>
  );
}
