import { BestWindow } from "@/lib/types";

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit"
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
    return `${formatTime(startTime)}–${formatTime(endTime)}`;
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
    return `${formatDayAndTime(startTime)}–${formatTimeOnly(endTime)}`;
  }

  return `${formatDayAndTime(startTime)}–${formatDayAndTime(endTime)}`;
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
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-2xl font-bold text-slate-100">
        {formatBestWindowLabel(bestWindow.startTime, bestWindow.endTime, includeDay)}
      </p>
      <p className="mt-1 text-sm text-slate-300">Gjennomsnittlig værscore: {bestWindow.averageScore}/100</p>
      <p className="mt-2 text-sm text-slate-400">{bestWindow.explanation}</p>
    </div>
  );
}
