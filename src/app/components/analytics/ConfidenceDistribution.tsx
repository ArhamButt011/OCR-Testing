// src/app/admin/components/analytics/ConfidenceDistribution.tsx
"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ConfidenceDistributionProps {
  data: Array<{
    range: string;
    count: number;
  }>;
}

export const ConfidenceDistribution: React.FC<ConfidenceDistributionProps> = ({ data }) => {
  // Colors for confidence levels (low to high)
  const getColor = (range: string) => {
    if (range.startsWith('0-') || range.startsWith('20-')) return '#ef4444'; // Red (low confidence)
    if (range.startsWith('40-')) return '#f59e0b'; // Orange
    if (range.startsWith('60-')) return '#10b981'; // Green
    return '#3b82f6'; // Blue (high confidence)
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Confidence Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.range)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
          <span className="text-gray-600">Low (0-40%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
          <span className="text-gray-600">Medium (40-60%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
          <span className="text-gray-600">Good (60-80%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span className="text-gray-600">High (80-100%)</span>
        </div>
      </div>
    </div>
  );
};