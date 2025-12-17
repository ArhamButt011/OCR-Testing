// src/app/admin/components/analytics/UnregisteredTrend.tsx
"use client";

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface UnregisteredTrendProps {
  data: Array<{
    date: string;
    unregisteredRate: number;
  }>;
}

export const UnregisteredTrend: React.FC<UnregisteredTrendProps> = ({ data }) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Unregistered Document Rate Trend
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorUnregistered" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Area
            type="monotone"
            dataKey="unregisteredRate"
            stroke="#ef4444"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorUnregistered)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};