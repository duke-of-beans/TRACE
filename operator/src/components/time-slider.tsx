/**
 * TRACE Operator — Time Slider
 *
 * Scrub through sighting data temporally.
 * Controls which time bucket is displayed on the map.
 */
import { useState, useCallback } from "react";

type TimeSliderProps = {
  buckets: Array<{ startTime: string; endTime: string; pointCount: number }>;
  selectedIndex: number;
  onChange: (index: number) => void;
  playing?: boolean;
  onTogglePlay?: () => void;
};

export function TimeSlider({
  buckets,
  selectedIndex,
  onChange,
  playing = false,
  onTogglePlay,
}: TimeSliderProps) {
  if (buckets.length === 0) return null;

  const current = buckets[selectedIndex];
  const startDate = new Date(current?.startTime || "");
  const endDate = new Date(current?.endTime || "");

  return (
    <div className="bg-trace-surface rounded-lg p-4 border border-trace-border">
      <div className="flex items-center gap-4 mb-2">
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 flex items-center justify-center rounded bg-trace-bg text-trace-accent text-sm"
        >
          {playing ? "⏸" : "▶"}
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={buckets.length - 1}
            value={selectedIndex}
            onChange={(e) => onChange(parseInt(e.target.value))}
            className="w-full accent-[#4fc3f7]"
          />
        </div>
        <div className="text-xs text-gray-400 w-36 text-right">
          {buckets[selectedIndex]?.pointCount || 0} sightings
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{startDate.toLocaleString()}</span>
        <span>{endDate.toLocaleString()}</span>
      </div>
      {/* mini histogram */}
      {buckets.length > 1 && (
        <div className="flex items-end gap-px mt-2 h-8">
          {buckets.map((b, i) => {
            const maxPts = Math.max(...buckets.map((x) => x.pointCount), 1);
            const h = (b.pointCount / maxPts) * 100;
            return (
              <div
                key={i}
                onClick={() => onChange(i)}
                className="flex-1 cursor-pointer rounded-t transition-colors"
                style={{
                  height: `${Math.max(h, 8)}%`,
                  minHeight: 3,
                  background: i === selectedIndex ? "#4fc3f7" : "#2a2a3e",
                  opacity: i === selectedIndex ? 1 : 0.5,
                }}
                title={`${b.pointCount} sighting${b.pointCount !== 1 ? "s" : ""}`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
