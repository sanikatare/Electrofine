"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  accent?: "green" | "black" | "neutral";
  delay?: number;
  className?: string;
}

const ACCENT_STYLES = {
  green: "bg-green-50 text-green-700",
  black: "bg-neutral-900 text-white",
  neutral: "bg-muted text-foreground",
};

/**
 * Premium animated KPI card used across Admin / Customer / Kabadiwala
 * dashboards. Pair with StatCardSkeleton while loading.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "green",
  delay = 0,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -3, boxShadow: "0 12px 24px -8px rgba(0,0,0,0.12)" }}
      className={cn(
        "rounded-xl border bg-card p-5 transition-shadow",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {trend && (
            <p
              className={cn(
                "mt-1 text-xs font-medium",
                trend.positive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.positive ? "▲" : "▼"} {trend.value}
            </p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", ACCENT_STYLES[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
