import { BestWindow } from "@/lib/types";

function formatTime(time: string): string {
  return new Date(time).toLocaleTimeString("nb-NO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

interface BestWindowCardProps {
  bestWindow: BestWindow | null;
  title: string;
  emptyMessage: string;
}

export function BestWindowCard({ bestWindow, title, emptyMessage }: BestWindowCardProps) {
  if (!bestWindow) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-2xl font-bold text-slate-900">
        {formatTime(bestWindow.startTime)}–{formatTime(bestWindow.endTime)}
      </p>
      <p className="mt-1 text-sm text-slate-700">Gjennomsnittlig sykkelscore: {bestWindow.averageScore}/100</p>
      <p className="mt-2 text-sm text-slate-600">{bestWindow.explanation}</p>
    </div>
  );
}
