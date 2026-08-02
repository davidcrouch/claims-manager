'use client';

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

export interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'pie' | 'scatter';
  title: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKeys: string[];
  colors?: string[];
}

export function InlineChart({ spec }: { spec: ChartSpec }) {
  const chartColors = spec.colors ?? COLORS;

  if (spec.type === 'pie') {
    return (
      <div className="my-3 rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-medium text-slate-700">{spec.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={spec.data}
              dataKey={spec.yKeys[0]}
              nameKey={spec.xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={chartColors[i % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (spec.type === 'scatter') {
    return (
      <div className="my-3 rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="mb-2 text-sm font-medium text-slate-700">{spec.title}</h4>
        <ResponsiveContainer width="100%" height={300}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={spec.xKey} name={spec.xKey} />
            <YAxis dataKey={spec.yKeys[0]} name={spec.yKeys[0]} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Legend />
            <Scatter data={spec.data} fill={chartColors[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const ChartWrapper =
    spec.type === 'area' ? AreaChart : spec.type === 'line' ? LineChart : BarChart;

  return (
    <div className="my-3 rounded-lg border border-slate-200 bg-white p-4">
      <h4 className="mb-2 text-sm font-medium text-slate-700">{spec.title}</h4>
      <ResponsiveContainer width="100%" height={300}>
        <ChartWrapper data={spec.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={spec.xKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {spec.yKeys.map((key, i) => {
            const color = chartColors[i % chartColors.length];
            if (spec.type === 'area') {
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  fill={color}
                  stroke={color}
                  fillOpacity={0.3}
                />
              );
            }
            if (spec.type === 'line') {
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              );
            }
            return <Bar key={key} dataKey={key} fill={color} />;
          })}
        </ChartWrapper>
      </ResponsiveContainer>
    </div>
  );
}

export function isChartSpec(data: unknown): data is ChartSpec {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.type === 'string' &&
    ['bar', 'line', 'area', 'pie', 'scatter'].includes(d.type) &&
    typeof d.title === 'string' &&
    Array.isArray(d.data) &&
    typeof d.xKey === 'string' &&
    Array.isArray(d.yKeys)
  );
}
