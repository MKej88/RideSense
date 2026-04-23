import { ScoreBadge } from "@/components/ScoreBadge";
import { getScoreLabel } from "@/lib/scoring";
import { BestWindow, ScoreLabel } from "@/lib/types";
import { formatOsloDayAndTime, formatOsloTime, getOsloDayKey } from "@/lib/time-format";

const TIME_RANGE_SEPARATOR = " - ";

function formatBestWindowLabel(startTime: string, endTime: string, includeDay: boolean): string {
  if (!includeDay) {
    return `${formatOsloTime(startTime)}${TIME_RANGE_SEPARATOR}${formatOsloTime(endTime)}`;
  }

  const startDay = getOsloDayKey(startTime);
  const endDay = getOsloDayKey(endTime);

  if (startDay === endDay) {
    return `${formatOsloDayAndTime(startTime)}${TIME_RANGE_SEPARATOR}${formatOsloTime(endTime)}`;
  }

  return `${formatOsloDayAndTime(startTime)}${TIME_RANGE_SEPARATOR}${formatOsloDayAndTime(endTime)}`;
}

function scoreLabelFromAverage(score: number): ScoreLabel {
  return getScoreLabel(score);
}

interface BestWindowCardProps {
  bestWindow: BestWindow | null;
  title: string;
  emptyMessage: string;
  includeDay?: boolean;
}

export function BestWindowCard({
  bestWindow,
  title,
  emptyMessage,
  includeDay = false
}: BestWindowCardProps) {
  if (!bestWindow) {
    return (
      <div className="rs-surface p-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const averageLabel = scoreLabelFromAverage(bestWindow.averageScore);

  return (
    <div className="rs-surface-strong p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-2xl font-bold text-slate-100">
        {formatBestWindowLabel(bestWindow.startTime, bestWindow.endTime, includeDay)}
      </p>
      <div className="mt-2">
        <ScoreBadge label={averageLabel} score={bestWindow.averageScore} />
      </div>
      <p className="mt-2 text-sm text-slate-400">{bestWindow.explanation}</p>
    </div>
  );
}
