// src/app/admin/components/analytics/DocsPerTemplateChart.tsx
"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DocsPerTemplateChartProps {
  data: Array<{
    date: string;
    template_name: string;
    count: number;
  }>;
}

export const DocsPerTemplateChart: React.FC<DocsPerTemplateChartProps> = ({ data }) => {
  // Transform data for Recharts
  const transformedData = React.useMemo(() => {
    const dateMap = new Map();
    
    data.forEach(item => {
      if (!dateMap.has(item.date)) {
        dateMap.set(item.date, { date: item.date });
      }
      const templateName = item.template_name || 'Unknown';
      dateMap.get(item.date)[templateName] = item.count;
    });
    
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  // Get unique template names for lines
  const templates = React.useMemo(() => {
    const uniqueTemplates = new Set<string>();
    data.forEach(item => {
      if (item.template_name) {
        uniqueTemplates.add(item.template_name);
      }
    });
    return Array.from(uniqueTemplates);
  }, [data]);

  // Colors for different templates
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Documents Processed Per Template
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={transformedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          {templates.map((template, index) => (
            <Line
              key={template}
              type="monotone"
              dataKey={template}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};