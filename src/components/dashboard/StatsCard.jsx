import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, subtitle, icon: Icon, trend, className }) {
  return (
    <Card className={cn("p-5 relative overflow-hidden", className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          )}
          {trend && (
            <p className={cn(
              "mt-1 text-xs font-medium",
              trend > 0 ? "text-emerald-600" : "text-red-500"
            )}>
              {trend > 0 ? '+' : ''}{trend}% vs last week
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-xl bg-slate-100">
            <Icon className="w-5 h-5 text-slate-600" />
          </div>
        )}
      </div>
    </Card>
  );
}