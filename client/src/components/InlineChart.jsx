import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS = ['var(--accent)', 'var(--green)', 'var(--amber)', 'var(--red)', '#378ADD', '#E24B4A'];

export default function InlineChart({ chartSpec }) {
  if (!chartSpec || !chartSpec.data || chartSpec.data.length === 0) return null;

  const renderChart = () => {
    switch (chartSpec.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartSpec.data} margin={{ top: 8, right: 8, bottom: 40, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                angle={-35}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
              />
              <Tooltip
                formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, chartSpec.yAxisLabel || 'Amount']}
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Bar dataKey="value" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartSpec.data} margin={{ top: 8, right: 8, bottom: 40, left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                angle={-35}
                textAnchor="end"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
              />
              <Tooltip
                formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, chartSpec.yAxisLabel || 'Amount']}
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
              <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartSpec.data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {chartSpec.data.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v) => [`₹${v.toLocaleString('en-IN')}`, chartSpec.yAxisLabel || 'Amount']}
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
                itemStyle={{ color: 'var(--text-primary)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Unsupported chart type: {chartSpec.type}</p>;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="inline-chart-container"
    >
      <p className="inline-chart-title">
        {chartSpec.title || 'Financial Chart'}
      </p>
      {renderChart()}
    </motion.div>
  );
}
