"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartSkeleton } from "@/components/shared/skeletons";
import { ErrorBoundary } from "@/components/shared/error-boundary";

interface ChartCardProps {
  title: string;
  description?: string;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, description, loading, children, className }: ChartCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          {loading ? <ChartSkeleton /> : <ErrorBoundary fallbackTitle="Chart failed to load">{children}</ErrorBoundary>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
