import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/shared/StatsCard";
import { CardSkeleton } from "@/components/shared/LoadingState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, CalendarDays, Users, TrendingUp, CheckCircle2, Download, Upload, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PlacementRecordTable } from "@/components/shared/PlacementRecordTable";

const CHART_COLORS = [
  "hsl(221, 83%, 53%)",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(0, 84%, 60%)",
];

export default function TPOOverview() {
  const { user } = useAuth();

  // Fetch companies count
  const { data: companiesCount, isLoading: loadingCompanies } = useQuery({
    queryKey: ["companies-count"],
    queryFn: async () => {
      // Count unique company names from placement_records
      const { data } = await supabase.from("placement_records" as any).select("company_name");
      if (!data) return 0;
      // Get unique company names
      const uniqueCompanies = new Set(data.map((r: any) => r.company_name?.toLowerCase().trim()));
      return uniqueCompanies.size;
    },
  });

  // Fetch drives count for current year
  const { data: drivesCount, isLoading: loadingDrives } = useQuery({
    queryKey: ["drives-count"],
    queryFn: async () => {
      // Count unique "Company + Date + Dept" combinations or just simple drives? 
      // User asked to use placement_record. We can count unique (Company Name) entries as proxy for drives
      // OR we can just count records. Let's stick to unique Companies visited for now as "Drives" proxy
      // since one company usually does one drive per year.
      const { data } = await supabase.from("placement_records" as any).select("company_name, date_of_join"); // date_of_join is usually later.
      // Actually, let's just count unique companies for now as the user prompt is vague on "Drives", 
      // but typically "Drives" = "Companies Visited".
      if (!data) return 0;
      const uniqueDrives = new Set(data.map((r: any) => r.company_name?.toLowerCase().trim()));
      return uniqueDrives.size; // Same as companies for now
    },
  });

  // Fetch total selections
  const { data: selectionsData, isLoading: loadingSelections } = useQuery({
    queryKey: ["selections-total"],
    queryFn: async () => {
      const { data } = await supabase.from("placement_records" as any).select("*");
      if (!data) return { selected: 0, appeared: 0 };

      const placedCount = data.filter((r: any) =>
        r.internship_or_placed?.toLowerCase() === 'placed' ||
        r.internship_or_placed?.toLowerCase() === 'both'
      ).length;

      // For appeared, we might not have data in this table, but for now let's assume
      // total records is a proxy or we just show N/A if needed. 
      // User asked to use stats from THIS RECORD. 
      // Let's treat total rows as "Students with Offers/Activity"
      return {
        selected: placedCount,
        appeared: data.length // This is strictly "Students recorded in the sheet"
      };
    },
  });

  // Fetch department-wise stats
  const { data: deptStats } = useQuery({
    queryKey: ["dept-stats"],
    queryFn: async () => {
      const { data: records } = await supabase.from("placement_records" as any).select("department, internship_or_placed");

      if (!records) return [];

      // Group by department
      const deptMap: Record<string, { selected: number; total: number }> = {};

      records.forEach((r: any) => {
        const dept = r.department || "Unknown";
        if (!deptMap[dept]) deptMap[dept] = { selected: 0, total: 0 };

        deptMap[dept].total += 1;
        if (r.internship_or_placed?.toLowerCase() === 'placed' || r.internship_or_placed?.toLowerCase() === 'both') {
          deptMap[dept].selected += 1;
        }
      });

      return Object.entries(deptMap).map(([name, stats]) => ({
        name,
        selected: stats.selected,
        appeared: stats.total, // Using total records as proxy for appeared in this context
        rate: stats.total > 0 ? Math.round((stats.selected / stats.total) * 100) : 0,
      }));
    },
  });

  // Fetch recent drives
  const { data: recentDrives } = useQuery({
    queryKey: ["recent-drives"],
    queryFn: async () => {
      const { data } = await supabase
        .from("placement_drives")
        .select(`
          id,
          visit_date,
          drive_type,
          role_offered,
          companies (name)
        `)
        .order("visit_date", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Drive type distribution
  const { data: driveTypeData } = useQuery({
    queryKey: ["drive-types"],
    queryFn: async () => {
      const { data } = await supabase.from("placement_records" as any).select("internship_or_placed");
      if (!data) return [];

      const counts = data.reduce((acc: any, d: any) => {
        const type = d.internship_or_placed || "Unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(counts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: value as number,
      }));
    },
  });

  const placementRate =
    selectionsData && selectionsData.appeared > 0
      ? Math.round((selectionsData.selected / selectionsData.appeared) * 100)
      : 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Overview</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with placements.
          </p>
        </div>

        {/* Quick Actions & Search */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between p-4 border rounded-lg bg-card shadow-sm">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/THALA TEMPLATE.xlsx" download="THALA TEMPLATE.xlsx">
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </a>
            </Button>
          </div>
          {/* Global search is now integrated into the Placement Record Table below */}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {loadingCompanies ? (
            <CardSkeleton />
          ) : (
            <StatsCard
              title="Total Companies"
              value={companiesCount || 0}
              icon={<Building2 className="h-6 w-6" />}
              variant="primary"
              trend={{ value: 12, label: "vs last year" }}
            />
          )}
          {loadingDrives ? (
            <CardSkeleton />
          ) : (
            <StatsCard
              title="Placement Drives"
              value={drivesCount || 0}
              icon={<CalendarDays className="h-6 w-6" />}
              variant="default"
              trend={{ value: 8, label: "vs last year" }}
            />
          )}
          {loadingSelections ? (
            <CardSkeleton />
          ) : (
            <StatsCard
              title="Students Placed"
              value={selectionsData?.selected || 0}
              icon={<Users className="h-6 w-6" />}
              variant="success"
              trend={{ value: 15, label: "vs last year" }}
            />
          )}
          {loadingSelections ? (
            <CardSkeleton />
          ) : (
            <StatsCard
              title="Placement Rate"
              value={`${placementRate}%`}
              icon={<TrendingUp className="h-6 w-6" />}
              variant="warning"
              trend={{ value: 5, label: "vs last year" }}
            />
          )}
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Department-wise Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Department Performance</CardTitle>
              <CardDescription>Placement statistics by department</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {deptStats && deptStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={deptStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="selected" fill="hsl(142, 76%, 36%)" name="Selected" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="appeared" fill="hsl(221, 83%, 53%)" name="Appeared" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No data available yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drive Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Drive Distribution</CardTitle>
              <CardDescription>Breakdown by drive type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {driveTypeData && driveTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={driveTypeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {driveTypeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    No drives recorded yet
                  </div>
                )}
              </div>
              {driveTypeData && driveTypeData.length > 0 && (
                <div className="flex justify-center gap-6 mt-4">
                  {driveTypeData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="text-sm text-muted-foreground">{entry.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Drives */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Placement Drives</CardTitle>
            <CardDescription>Latest company visits and drive activities</CardDescription>
          </CardHeader>
          <CardContent>
            {recentDrives && recentDrives.length > 0 ? (
              <div className="space-y-4">
                {recentDrives.map((drive) => (
                  <div
                    key={drive.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{(drive.companies as any)?.name || "Unknown Company"}</p>
                        <p className="text-sm text-muted-foreground">
                          {drive.role_offered || "Multiple Roles"} • {drive.drive_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {new Date(drive.visit_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No placement drives recorded yet</p>
                <p className="text-sm text-muted-foreground">
                  Start by adding companies and scheduling drives
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Placement Record Table */}
        <PlacementRecordTable />
      </div>
    </DashboardLayout >
  );
}