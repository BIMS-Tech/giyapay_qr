import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
  Alert, Box, Card, CardContent, Chip, CircularProgress, Container, Grid,
  MenuItem, Paper, Select, Skeleton, Typography, useTheme,
} from '@mui/material';
import {
  QrCode2 as QrIcon,
  PaymentsOutlined as AmountIcon,
  CheckCircleOutline as SettledIcon,
  TrendingUp as RateIcon,
  StorefrontOutlined as BranchIcon,
  GroupOutlined as UsersIcon,
} from '@mui/icons-material';
import { AreaChart, DonutChart, BarList, statusColor } from '../Components/Charts';

const PERIODS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});

const compactPeso = (value) =>
  value >= 1_000_000 ? `₱${(value / 1_000_000).toFixed(1)}M`
  : value >= 1_000 ? `₱${(value / 1_000).toFixed(1)}k`
  : peso.format(value || 0);

// The token is the authority on role - the separate localStorage copy can drift.
const readRole = () => {
  try {
    return jwtDecode(localStorage.getItem('token')).userType;
  } catch {
    return null;
  }
};

const StatCard = ({ icon: Icon, label, value, hint, accent }) => (
  <Card elevation={0} sx={{ height: '100%', border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <CardContent>
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center',
            bgcolor: accent, color: '#fff', flexShrink: 0,
          }}
        >
          <Icon fontSize="small" />
        </Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>

      <Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1.1 }}>
        {value}
      </Typography>

      {hint && (
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      )}
    </CardContent>
  </Card>
);

const Panel = ({ title, action, children }) => (
  <Paper elevation={0} sx={{ p: 2.5, height: '100%', border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      {action}
    </Box>
    {children}
  </Paper>
);

const OverView = () => {
  const theme = useTheme();
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const role = useMemo(readRole, []);
  // Branch users get a narrower dashboard: no cross-branch ranking, no user count.
  const isBranchUser = role === 'Branch User';

  const fetchAnalytics = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const { data: payload } = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/api/analytics/dashboard`,
        {
          params: { days },
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          signal,
        }
      );
      setData(payload);
    } catch (err) {
      if (axios.isCancel(err)) return;
      console.error('Error loading dashboard analytics:', err);
      setError(
        err.response?.status === 401
          ? 'Your session has expired. Please sign in again.'
          : 'Could not load dashboard analytics. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAnalytics(controller.signal);
    return () => controller.abort();
  }, [fetchAnalytics]);

  const totals = data?.totals ?? {};
  const busiestDay = useMemo(() => {
    if (!data?.series?.length) return null;
    return data.series.reduce((best, d) => (d.count > best.count ? d : best), data.series[0]);
  }, [data]);

  if (loading && !data) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Grid container spacing={2}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rounded" height={140} />
            </Grid>
          ))}
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={300} /></Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      <Box
        display="flex" justifyContent="space-between" alignItems="center"
        flexWrap="wrap" gap={2} mb={3}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {isBranchUser ? 'Activity for your branch' : 'Activity across your merchant account'}
          </Typography>
        </Box>

        <Box display="flex" alignItems="center" gap={1}>
          {loading && <CircularProgress size={18} />}
          <Select
            size="small"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            sx={{ minWidth: 150 }}
          >
            {PERIODS.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      <Grid container spacing={2} mb={1}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={QrIcon}
            label="QR codes"
            value={(totals.qrCodes ?? 0).toLocaleString()}
            hint={busiestDay ? `Busiest day ${busiestDay.date} (${busiestDay.count})` : null}
            accent={theme.palette.primary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={AmountIcon}
            label="Total value"
            value={compactPeso(totals.totalAmount)}
            hint="All QR codes in range"
            accent={theme.palette.secondary.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={SettledIcon}
            label="Settled"
            value={compactPeso(totals.paidAmount)}
            hint={`${(totals.paidCount ?? 0).toLocaleString()} paid`}
            accent={theme.palette.success.main}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            icon={RateIcon}
            label="Conversion"
            value={`${Math.round((totals.conversionRate ?? 0) * 100)}%`}
            hint="Paid vs created"
            accent={theme.palette.info.main}
          />
        </Grid>

        {!isBranchUser && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={BranchIcon}
                label="Branches"
                value={(totals.branches ?? 0).toLocaleString()}
                accent={theme.palette.warning.main}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={UsersIcon}
                label="Users"
                value={(totals.users ?? 0).toLocaleString()}
                accent={theme.palette.grey[600]}
              />
            </Grid>
          </>
        )}
      </Grid>

      <Grid container spacing={2} mt={0}>
        <Grid item xs={12} md={8}>
          <Panel
            title="QR codes created"
            action={<Chip size="small" label={`${data?.days ?? days} days`} />}
          >
            <AreaChart data={data?.series ?? []} valueKey="count" height={240} />
          </Panel>
        </Grid>

        <Grid item xs={12} md={4}>
          <Panel title="By status">
            <DonutChart data={data?.statusBreakdown ?? []} height={180} />
          </Panel>
        </Grid>

        {!isBranchUser && (
          <Grid item xs={12} md={6}>
            <Panel title="Top branches">
              <BarList
                data={data?.topBranches ?? []}
                labelKey="branch_name"
                valueKey="count"
                formatValue={(v) => `${v.toLocaleString()} QR`}
              />
            </Panel>
          </Grid>
        )}

        <Grid item xs={12} md={isBranchUser ? 12 : 6}>
          <Panel title="Recent activity">
            {(data?.recent ?? []).length === 0 ? (
              <Typography variant="body2" color="text.disabled">Nothing yet</Typography>
            ) : (
              data.recent.map((row) => (
                <Box
                  key={row.id}
                  display="flex" alignItems="center" justifyContent="space-between"
                  gap={1} py={1}
                  sx={{ borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}
                >
                  <Box minWidth={0}>
                    <Typography variant="body2" noWrap>
                      {row.payment_reference || '(no reference)'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(row.createdAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1.5} flexShrink={0}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {peso.format(row.amount || 0)}
                    </Typography>
                    <Chip
                      size="small"
                      label={row.status}
                      sx={{
                        textTransform: 'capitalize',
                        bgcolor: `${statusColor(theme, row.status)}22`,
                        color: statusColor(theme, row.status),
                        fontWeight: 500,
                      }}
                    />
                  </Box>
                </Box>
              ))
            )}
          </Panel>
        </Grid>
      </Grid>
    </Container>
  );
};

export default OverView;
