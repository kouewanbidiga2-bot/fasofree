/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// Palette monochrome terre (beige/encre/terracotta) — plus d'arc-en-ciel.
const CHART_COLORS = [
  '#C1652E', '#241F1B', '#A08B6F', '#D9C6A8',
  '#6E6559', '#8A5A3B', '#3F3831', '#CBB79A',
];

const CHART_TYPES = [
  { key: 'line', label: 'Courbe' },
  { key: 'bar', label: 'Barres' },
  { key: 'area', label: 'Aires' },
  { key: 'pie', label: 'Camembert' },
];

const CustomTooltip = ({ active, payload, label, formatValue }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#EAE3D8] bg-white px-3 py-2 text-xs shadow-sm">
      <p className="mb-1 font-bold text-text-primary">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="font-semibold" style={{ color: entry.color }}>
          {entry.name}: {formatValue ? formatValue(entry.value) : entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

const FinancialChart = ({
  data = [],
  series = [], // [{ key: 'revenue', name: 'Revenus', color: '#C1652E' }]
  title = '',
  height = 300,
  formatValue,
  pieMode = false,
}) => {
  const [chartType, setChartType] = useState('line');

  const fmt = formatValue || ((v) => v?.toLocaleString() + ' FCFA');
  const formatXAxis = (val) => {
    if (!val) return '';
    const d = new Date(val);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  };

  if (!data.length || !series.length) {
    return (
      <div className="bg-background-card rounded-xl border border-border-light overflow-hidden">
        {title && (
          <div className="px-5 pt-4 pb-2">
            <h3 className="text-sm font-bold text-text-primary">{title}</h3>
          </div>
        )}
        <div className="flex items-center justify-center py-16 text-text-tertiary text-sm">
          Aucune donnée disponible
        </div>
      </div>
    );
  }

  // Pie data: aggregate each series across all dates
  const pieData = series.map((s) => ({
    name: s.name,
    value: data.reduce((sum, d) => sum + (Number(d[s.key]) || 0), 0),
    color: s.color,
  })).filter((d) => d.value > 0);

  const tooltipFormatter = (value) => fmt(value);

  const renderChart = () => {
    if (chartType === 'pie') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={height * 0.2}
              outerRadius={height * 0.38}
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip formatter={tooltipFormatter} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const commonAxis = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#EFE8DC" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatXAxis}
          tick={{ fontSize: 10, fill: '#9B9286' }}
          axisLine={{ stroke: '#EAE3D8' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9B9286' }}
          axisLine={false}
          tickLine={false}
          width={60}
          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        />
        <Tooltip content={<CustomTooltip formatValue={fmt} />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
      </>
    );

    if (chartType === 'bar') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barGap={1}>
            {commonAxis}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            {commonAxis}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    // default: area
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          {commonAxis}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.08}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="bg-background-card rounded-xl border border-border-light overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        {title && <h3 className="text-sm font-bold text-text-primary">{title}</h3>}
        <div className="flex gap-1">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setChartType(ct.key)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                chartType === ct.key
                  ? 'bg-[#241F1B] text-white'
                  : 'text-text-tertiary hover:text-text-primary hover:bg-background-secondary'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>
      <div className="px-2 pb-2">
        {renderChart()}
      </div>
    </div>
  );
};

export default FinancialChart;
