"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Truck,
  IndianRupee,
  PackageCheck,
  Clock,
  Recycle,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { ChartCard } from "@/components/dashboard/chart-card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { PickupsChart } from "@/components/dashboard/pickups-chart";
import { CategoryCollectionChart } from "@/components/dashboard/category-collection-chart";
import { KabadiwalaPerformanceChart } from "@/components/dashboard/kabadiwala-performance-chart";
import { GlobalSearch } from "@/components/search/global-search";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { StatCardSkeleton } from "@/components/shared/skeletons";

interface DashboardCards {
  customers: number;
  kabadiwalas: number;
  revenue: number;
  completedPickups: number;
  pendingPickups: number;
  collectedWasteKg: number;
}

interface ChartData {
  revenueSeries: { month: string; revenue: number }[];
  pickupsSeries: { month: string; count: number }[];
  categoryCollection: { category: string; weightKg: number }[];
  kabadiwalaPerformance: { name: string; completedPickups: number; rating: number }[];
}

export default function AdminDashboardPage() {
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => res.json())
      .then((json) => setCards(json.data));

    fetch("/api/admin/dashboard/charts")
      .then((res) => res.json())
      .then((json) => setCharts(json.data));
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Operational overview across the ElectroFine network.
          </p>
        </div>
        <GlobalSearch />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {!cards ? (
          Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Customers" value={cards.customers} icon={Users} delay={0} />
            <StatCard label="Kabadiwalas" value={cards.kabadiwalas} icon={Truck} delay={0.05} />
            <StatCard
              label="Revenue"
              value={`₹${cards.revenue.toLocaleString("en-IN")}`}
              icon={IndianRupee}
              accent="black"
              delay={0.1}
            />
            <StatCard
              label="Completed Pickups"
              value={cards.completedPickups}
              icon={PackageCheck}
              delay={0.15}
            />
            <StatCard label="Pending Pickups" value={cards.pendingPickups} icon={Clock} delay={0.2} />
            <StatCard
              label="Collected Waste"
              value={`${cards.collectedWasteKg.toFixed(1)} kg`}
              icon={Recycle}
              delay={0.25}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ScrollReveal>
          <ChartCard title="Revenue" description="Last 12 months" loading={!charts}>
            {charts && <RevenueChart data={charts.revenueSeries} />}
          </ChartCard>
        </ScrollReveal>

        <ScrollReveal delay={0.05}>
          <ChartCard title="Monthly Pickups" description="Last 12 months" loading={!charts}>
            {charts && <PickupsChart data={charts.pickupsSeries} />}
          </ChartCard>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <ChartCard title="Category Collection" description="By weight (kg)" loading={!charts}>
            {charts && <CategoryCollectionChart data={charts.categoryCollection} />}
          </ChartCard>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <ChartCard title="Kabadiwala Performance" description="Top 5 by completed pickups" loading={!charts}>
            {charts && <KabadiwalaPerformanceChart data={charts.kabadiwalaPerformance} />}
          </ChartCard>
        </ScrollReveal>
      </div>
    </main>
  );
}
