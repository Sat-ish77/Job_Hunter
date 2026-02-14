import React from 'react';
import { cn } from "@/lib/utils";

export default function ScoreRing({ score, size = 48, strokeWidth = 4, className }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  const getColor = (score) => {
    if (score >= 80) return 'stroke-emerald-500';
    if (score >= 60) return 'stroke-blue-500';
    if (score >= 40) return 'stroke-amber-500';
    return 'stroke-red-400';
  };

  const getBgColor = (score) => {
    if (score >= 80) return 'stroke-emerald-100';
    if (score >= 60) return 'stroke-blue-100';
    if (score >= 40) return 'stroke-amber-100';
    return 'stroke-red-100';
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={getBgColor(score)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(getColor(score), "transition-all duration-500")}
        />
      </svg>
      <span className="absolute text-xs font-semibold text-slate-700">
        {score}
      </span>
    </div>
  );
}