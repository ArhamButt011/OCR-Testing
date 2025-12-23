// src/app/admin/analytics/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// Components
import { useSidebar } from "../context/SidebarContext";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";

// Analytics Components
import { SummaryCards } from "../components/analytics/SummaryCards";
import { DocsPerTemplateChart } from "../components/analytics/DocsPerTemplateChart";
import { ConfidenceDistribution } from "../components/analytics/ConfidenceDistribution";
import { UnregisteredTrend } from "../components/analytics/UnregisteredTrend";
import { TemplateRanking } from "../components/analytics/TemplateRanking";
import { ProcessingTimeTable } from "../components/analytics/ProcessingTimeTable";
import { DateRangeFilter } from "../components/analytics/DateRangeFilter";

export default function AnalyticsPage() {
  const router = useRouter();
  const { isExpanded } = useSidebar();

  const [loading, setLoading] = useState(true);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin-login");
      return;
    }

    const decodeJwt = (token: string) => {
      try {
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        return null;
      }
    };

    const decodedToken = decodeJwt(token);
    const currentTime = Date.now() / 1000;
    if (!decodedToken || decodedToken.exp < currentTime) {
      localStorage.removeItem("token");
      router.push("/admin-login");
      return;
    }
    if (decodedToken.role !== "admin") {
      router.push("/extracted-data-monitoring");
      return;
    }

    setIsAuthenticated(true);
    setLoadingAuth(false);
  }, [router]);

  // Fetch analytics data
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAnalytics();
  }, [isAuthenticated, dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });

      const response = await fetch(`/api/templates/analytics?${params.toString()}`);
      
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      } else {
        console.error("Failed to fetch analytics");
      }
    } catch (error) {
      console.error("Analytics fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'excel') => {
    try {
      const response = await fetch('/api/templates/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'summary',
          startDate: dateRange.startDate,
          endDate: dateRange.endDate
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_${dateRange.startDate}_${dateRange.endDate}.csv`;
        a.click();
      }
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
  };

  if (loadingAuth) return <Spinner />;
  if (!isAuthenticated) return <p className="p-8">Access Denied. Redirecting...</p>;

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-white">
      {/* Sidebar */}
      <div className="">
        <Sidebar onStateChange={handleSidebarStateChange} />
      </div>

      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          isExpanded ? "lg:ml-64" : "ml-24"
        }`}
      >
        {/* Main Content */}
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Page Header */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Classification Analytics
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Document processing metrics and insights
                  </p>
                </div>
                <div className="flex gap-2">
                  {/* <button
                    onClick={() => handleExport('csv')}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Export CSV
                  </button> */}
                  <button
                    onClick={() => handleExport('excel')}
                    className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary"
                  >
                    Export Data
                  </button>
                </div>
              </div>
            </div>

            {/* Date Range Filter */}
            <DateRangeFilter
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />

            {loading ? (
              <div className="text-center py-12">
                <Spinner />
                <p className="mt-4 text-gray-600">Loading analytics...</p>
              </div>
            ) : analyticsData ? (
              <>
                {/* Summary Cards */}
                <SummaryCards summary={analyticsData.summary} />

                {/* Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Documents Per Template */}
                  <DocsPerTemplateChart data={analyticsData.docsOverTime} />

                  {/* Confidence Distribution */}
                  <ConfidenceDistribution data={analyticsData.confidenceDistribution} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Unregistered Trend */}
                  <UnregisteredTrend data={analyticsData.unregisteredTrend} />

                  {/* Template Ranking */}
                  <TemplateRanking data={analyticsData.templateRanking} />
                </div>

                {/* Processing Time Table */}
                <ProcessingTimeTable data={analyticsData.docsPerTemplate} />
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}