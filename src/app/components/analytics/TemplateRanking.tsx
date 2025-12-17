// src/app/admin/components/analytics/TemplateRanking.tsx
"use client";

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TemplateRankingProps {
  data: Array<{
    template_name: string;
    count: number;
  }>;
}

export const TemplateRanking: React.FC<TemplateRankingProps> = ({ data }) => {
  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map(item => ({
    ...item,
    name: item.template_name || 'Unknown',
    percentage: ((item.count / total) * 100).toFixed(1)
  }));

  // Colors for ranking
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#f97316', '#06b6d4'];

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Template Usage Ranking
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" tick={{ fontSize: 12 }} />
          <YAxis 
            dataKey="name" 
            type="category" 
            tick={{ fontSize: 11 }}
            width={120}
          />
          <Tooltip 
            formatter={(value: number, name: string, props: any) => [
              `${value} docs (${props.payload.percentage}%)`,
              'Documents'
            ]}
          />
          <Bar dataKey="count" radius={[0, 8, 8, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Top 3 List */}
      <div className="mt-4 space-y-2">
        {/* <h4 className="text-sm font-medium text-gray-700">Top 3 Templates:</h4> */}
        {chartData.slice(0, 3).map((item, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center">
              <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded-full text-xs font-medium mr-2">
                {index + 1}
              </span>
              <span className="text-gray-900">{item.name}</span>
            </div>
            <span className="text-gray-600">
              {item.count.toLocaleString()} ({item.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};