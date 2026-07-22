"use client";

import { useEffect, useState } from "react";
import { Package, Clock, PackageCheck } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { PickupsChart } from "@/components/dashboard/pickups-chart";
import { StatusBadge } from "@/components/shared/status-badge";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StatCardSkeleton, CardSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerDashboardData {
  totalPickups: number;
  pendingPickups: number;
  completedPickups: number;
  monthlyPickups: { month: string; count: number }[];
  recentActivity: {
    id: string;
    status: string;
    scheduledDate: string;
    totalWeight: number | null;
    totalAmount: number | null;
    kabadiwala: { name: string } | null;
  }[];
}

export default function CustomerDashboardPage() {
  const [data, setData] = useState<CustomerDashboardData | null>(null);

  useEffect(() => {
    fetch("/api/customer/dashboard")
      .then((res) => res.json())
      .then((json) => setData(json.data));
  }, []);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your pickup requests and activity at a glance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {!data ? (
          Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Pickups" value={data.totalPickups} icon={Package} delay={0} />
            <StatCard label="Pending" value={data.pendingPickups} icon={Clock} delay={0.05} />
            <StatCard
              label="Completed"
              value={data.completedPickups}
              icon={PackageCheck}
              delay={0.1}
            />
          </>
        )}
      </div>

      <ScrollReveal>
        <ChartCard title="Monthly Pickups" description="Last 6 months" loading={!data}>
          {data && <PickupsChart data={data.monthlyPickups} />}
        </ChartCard>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!data && <CardSkeleton lines={4} />}
            {data && data.recentActivity.length === 0 && (
              <EmptyState
                title="No pickups yet"
                description="Schedule your first e-waste pickup to see it here."
              />
            )}
            {data && data.recentActivity.length > 0 && (
              <div className="space-y-3">
                {data.recentActivity.map((pickup) => (
                  <div
                    key={pickup.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        #{pickup.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pickup.scheduledDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        {pickup.kabadiwala && ` · ${pickup.kabadiwala.name}`}
                      </p>
                    </div>
                    <StatusBadge status={pickup.status} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </ScrollReveal>
    </main>
  );
}
