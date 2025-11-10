"use client";

export function ScheduleTimeline() {
  const hours = [
    { hour: 0, label: "12A" },
    { hour: 2, label: "2A" },
    { hour: 4, label: "4A" },
    { hour: 6, label: "6A" },
    { hour: 8, label: "8A" },
    { hour: 10, label: "10A" },
    { hour: 12, label: "12P" },
    { hour: 14, label: "2P" },
    { hour: 16, label: "4P" },
    { hour: 18, label: "6P" },
    { hour: 20, label: "8P" },
    { hour: 22, label: "10P" },
    { hour: 24, label: "12A" },
  ];

  return (
    <div className="relative w-full h-8 border-b border-slate-200/60 dark:border-slate-700/40">
      <div className="relative h-full">
        {hours.map(({ hour, label }) => {
          const position = (hour / 24) * 100;

          return (
            <div
              key={`${hour}-${label}`}
              className="absolute top-0 -translate-x-1/2 flex flex-col items-center"
              style={{ left: `${position}%` }}
            >
              <div className="w-[1px] h-2 bg-slate-300/60 dark:bg-slate-600/50" />

              <div className="text-[10px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
