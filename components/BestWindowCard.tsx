import { ScoreBadge } from "@/components/ScoreBadge";
import { getScoreLabel } from "@/lib/scoring";
import { BestWindow, ScoreLabel } from "@/lib/types";

const TIME_RANGE_SEPARATOR = " - ";

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString("nb-NO", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo"
  });
}

function formatDayAndTime(time: string): string {
  return new Date(time).toLocaleString("nb-NO", {
    weekday: "long",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo"
  });
}

function formatTimeOnly(time: string): string {
  return new Date(time).toLocaleTimeString("nb-NO", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Oslo"
  });
}

function formatBestWindowLabel(startTime: string, endTime: string, includeDay: boolean): string {
  if (!includeDay) {
    return `${formatTime(startTime)}${TIME_RANGE_SEPARATOR}${formatTime(endTime)}`;
  }

  const startDay = new Date(startTime).toLocaleDateString("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const endDay = new Date(endTime).toLocaleDateString("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  if (startDay === endDay) {
    return `${formatDayAndTime(startTime)}${TIME_RANGE_SEPARATOR}${formatTimeOnly(endTime)}`;
  }

  return `${formatDayAndTime(startTime)}${TIME_RANGE_SEPARATOR}${formatDayAndTime(endTime)}`;
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
      <div className="rs-card shadow-sm">
        <h2 className="rs-card-title">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  const averageLabel = scoreLabelFromAverage(bestWindow.averageScore);

  return (
    <div className="rs-card shadow-sm">
      <h2 className="rs-card-title">{title}</h2>
      <p className="rs-card-metric mt-2">
        {formatBestWindowLabel(bestWindow.startTime, bestWindow.endTime, includeDay)}
      </p>
      <div className="rs-card-action mt-2">
        <ScoreBadge label={averageLabel} score={bestWindow.averageScore} />
      </div>
      <p className="mt-2 text-sm text-slate-400">{bestWindow.explanation}</p>
    </div>
  );
}
