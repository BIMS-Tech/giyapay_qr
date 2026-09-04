import React, { useId } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

/**
 * Small SVG chart primitives.
 *
 * Drawn by hand rather than pulling in a charting library: the client bundle is
 * already ~1.4MB, and these three shapes are all the dashboard needs. Every
 * colour comes from the MUI theme so they follow the light/dark toggle.
 */

// Status names vary across the data ('paid' and 'success' both mean settled),
// so map by meaning rather than by an index into a palette.
export const statusColor = (theme, status) => {
  const key = String(status || '').toLowerCase();
  if (key === 'paid' || key === 'success') return theme.palette.success.main;
  if (key === 'pending') return theme.palette.warning.main;
  if (key === 'failed') return theme.palette.error.main;
  if (key === 'cancelled') return theme.palette.grey[500];
  return theme.palette.info.main;
};

const EmptyState = ({ height, label }) => (
  <Box
    height={height}
    display="flex"
    alignItems="center"
    justifyContent="center"
    sx={{ color: 'text.disabled' }}
  >
    <Typography variant="body2">{label}</Typography>
  </Box>
);

/** Filled line chart of a daily series. */
export const AreaChart = ({ data = [], valueKey = 'count', height = 220, color }) => {
  const theme = useTheme();
  const gradientId = useId();

  if (!data.length) return <EmptyState height={height} label="No activity in this period" />;

  const W = 600;
  const H = 200;
  const pad = { top: 12, right: 8, bottom: 22, left: 8 };

  const values = data.map((d) => Number(d[valueKey]) || 0);
  const max = Math.max(...values, 1);
  const stroke = color || theme.palette.primary.main;

  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / max) * innerH;

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
  const area = `${line} L ${x(values.length - 1).toFixed(2)} ${pad.top + innerH} L ${x(0).toFixed(2)} ${pad.top + innerH} Z`;

  // Only label the ends and middle; one tick per day is unreadable at 30+ days.
  const tickIdx = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Daily ${valueKey} over ${data.length} days`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={pad.left}
            x2={W - pad.right}
            y1={pad.top + innerH * f}
            y2={pad.top + innerH * f}
            stroke={theme.palette.divider}
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />

        {tickIdx.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 6}
            fontSize="11"
            fill={theme.palette.text.secondary}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
          >
            {String(data[i].date).slice(5)}
          </text>
        ))}
      </svg>
    </Box>
  );
};

/** Donut showing how the total splits by status. */
export const DonutChart = ({ data = [], height = 200 }) => {
  const theme = useTheme();

  const total = data.reduce((sum, d) => sum + (Number(d.count) || 0), 0);
  if (!total) return <EmptyState height={height} label="No QR codes yet" />;

  const size = 200;
  const r = 70;
  const thickness = 26;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;

  return (
    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
      <svg viewBox={`0 0 ${size} ${size}`} width={height} height={height} role="img" aria-label="QR codes by status">
        <g transform={`rotate(-90 ${c} ${c})`}>
          {data.map((d) => {
            const fraction = (Number(d.count) || 0) / total;
            const dash = fraction * circumference;
            const seg = (
              <circle
                key={d.status}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={statusColor(theme, d.status)}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x={c} y={c - 4} textAnchor="middle" fontSize="26" fontWeight="600" fill={theme.palette.text.primary}>
          {total.toLocaleString()}
        </text>
        <text x={c} y={c + 16} textAnchor="middle" fontSize="12" fill={theme.palette.text.secondary}>
          total
        </text>
      </svg>

      <Box flex="1" minWidth="140px">
        {data.map((d) => (
          <Box key={d.status} display="flex" alignItems="center" gap={1} mb={0.75}>
            <Box
              sx={{
                width: 10, height: 10, borderRadius: '50%',
                bgcolor: statusColor(theme, d.status), flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flex: 1, textTransform: 'capitalize' }}>
              {d.status}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {d.count.toLocaleString()} ({Math.round((d.count / total) * 100)}%)
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

/** Ranked horizontal bars - used for top branches. */
export const BarList = ({ data = [], labelKey = 'branch_name', valueKey = 'count', formatValue }) => {
  const theme = useTheme();

  if (!data.length) return <EmptyState height={160} label="No branch activity yet" />;

  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);

  return (
    <Box>
      {data.map((d) => {
        const value = Number(d[valueKey]) || 0;
        return (
          <Box key={d[labelKey]} mb={1.5}>
            <Box display="flex" justifyContent="space-between" mb={0.5}>
              <Typography variant="body2" noWrap sx={{ maxWidth: '70%' }}>
                {d[labelKey]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatValue ? formatValue(value) : value.toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 4, bgcolor: theme.palette.action.hover, overflow: 'hidden' }}>
              <Box
                sx={{
                  width: `${(value / max) * 100}%`,
                  height: '100%',
                  borderRadius: 4,
                  bgcolor: theme.palette.primary.main,
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
