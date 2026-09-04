import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Container,
  Divider, Grid, MenuItem, Paper, Select, Skeleton, Stack, Typography, useTheme,
} from '@mui/material';
import {
  AddBusinessOutlined as AddBranchIcon,
  PersonAddAlt1Outlined as AddUserIcon,
  UploadFileOutlined as UploadIcon,
  ArrowForward as ArrowIcon,
  HourglassEmptyOutlined as PendingIcon,
  ErrorOutlineOutlined as FailedIcon,
  TimerOffOutlined as ExpiredIcon,
} from '@mui/icons-material';
import { AreaChart, DonutChart, BarList, statusColor } from '../Components/Charts';

const PERIODS = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
];

// Statuses worth surfacing at the top, in the order an operator cares about.
const ATTENTION = [
  { status: 'pending', label: 'Pending', icon: PendingIcon, hint: 'Awaiting payment confirmation' },
  { status: 'failed', label: 'Failed', icon: FailedIcon, hint: 'Payment did not go through' },
  { status: 'expired', label: 'Expired', icon: ExpiredIcon, hint: 'Timed out before payment' },
];

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 0,
});

const compactPeso = (v) =>
  v >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `₱${(v / 1_000).toFixed(0)}k`
  : peso.format(v || 0);

const readRole = () => {
  try {
    return jwtDecode(localStorage.getItem('token')).userType;
  } catch {
    return null;
  }
};

// OverView is mounted at /super-dashboard and /co-admin-dashboard; branch users
// land on their QR list instead. Links have to follow whichever shell we are in.
const routesFor = (role) =>
  role === 'Co-Admin'
    ? { base: '/co-admin-dashboard', qrList: '/co-admin-dashboard/manage-qr-ca', canManage: false }
    : { base: '/super-dashboard', qrList: '/super-dashboard/manage-qr', canManage: true };

/** A number that is also a way in. */
const AttentionTile = ({ icon: Icon, label, hint, count, color, to }) => (
  <Card
    elevation={0}
    component={RouterLink}
    to={to}
    sx={{
      display: 'block', textDecoration: 'none', height: '100%',
      border: 1, borderColor: 'divider', borderLeft: 4, borderLeftColor: color,
      borderRadius: 2, transition: 'border-color .15s, transform .15s',
      '&:hover': { borderColor: color, transform: 'translateY(-2px)' },
    }}
  >
    <CardContent>
      <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
        <Icon sx={{ color, fontSize: 20 }} />
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Stack>

      <Stack direction="row" alignItems="baseline" justifyContent="space-between">
        <Typography variant="h4" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {count.toLocaleString()}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>Review</Typography>
          <ArrowIcon sx={{ fontSize: 14 }} />
        </Stack>
      </Stack>

      <Typography variant="caption" color="text.secondary">{hint}</Typography>
    </CardContent>
  </Card>
);

/** Compact KPI - these are context, not the main event, so they read as a strip. */
const Metric = ({ label, value, sub }) => (
  <Box sx={{ px: 2.5, py: 1.5, flex: '1 1 150px', minWidth: 150 }}>
    <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
    <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Box>
);

const Panel = ({ title, action, children }) => (
  <Paper elevation={0} sx={{ p: 2.5, height: '100%', border: 1, borderColor: 'divider', borderRadius: 2 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{title}</Typography>
      {action}
    </Stack>
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
  const routes = useMemo(() => routesFor(role), [role]);

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

  const byStatus = useMemo(() => {
    const map = new Map((data?.statusBreakdown ?? []).map((r) => [String(r.status).toLowerCase(), r.count]));
    return (s) => map.get(s) ?? 0;
  }, [data]);

  // Only surface a tile when there is actually something in it.
  const attention = ATTENTION
    .map((a) => ({ ...a, count: byStatus(a.status) }))
    .filter((a) => a.count > 0);

  if (loading && !data) {
    return (
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Skeleton variant="text" width={220} height={44} />
        <Grid container spacing={2} mt={1}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Grid item xs={12} sm={4} key={i}><Skeleton variant="rounded" height={130} /></Grid>
          ))}
          <Grid item xs={12}><Skeleton variant="rounded" height={90} /></Grid>
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={300} /></Grid>
        </Grid>
      </Container>
    );
  }

  return (
    <Container maxWidth={false} sx={{ py: 4 }}>
      {/* Title + the things an admin comes here to do */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {routes.canManage ? 'Overview and quick actions' : 'Overview for your merchant account'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
          {routes.canManage && (
            <>
              <Button
                component={RouterLink} to={`${routes.base}/manage-branches/add`}
                variant="outlined" size="small" startIcon={<AddBranchIcon />}
              >
                Branch
              </Button>
              <Button
                component={RouterLink} to={`${routes.base}/manage-users/add`}
                variant="outlined" size="small" startIcon={<AddUserIcon />}
              >
                User
              </Button>
              <Button
                component={RouterLink} to={`${routes.base}/upload`}
                variant="outlined" size="small" startIcon={<UploadIcon />}
              >
                Batch upload
              </Button>
            </>
          )}

          {loading && <CircularProgress size={18} />}
          <Select
            size="small" value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            sx={{ minWidth: 145 }}
          >
            {PERIODS.map((p) => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
          </Select>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Needs attention: leads the page, because it is the part you act on */}
      {attention.length > 0 && (
        <Box mb={3}>
          <Typography
            variant="overline"
            color="text.secondary"
            sx={{ letterSpacing: 1, fontWeight: 600 }}
          >
            Needs attention
          </Typography>
          <Grid container spacing={2} mt={0}>
            {attention.map((a) => (
              <Grid item xs={12} sm={6} md={4} key={a.status}>
                <AttentionTile
                  icon={a.icon}
                  label={a.label}
                  hint={a.hint}
                  count={a.count}
                  color={statusColor(theme, a.status)}
                  to={`${routes.qrList}?status=${a.status}`}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Headline numbers, as a single strip rather than six competing cards */}
      <Paper
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 2, mb: 3, overflow: 'hidden' }}
      >
        <Stack
          direction="row"
          flexWrap="wrap"
          divider={<Divider orientation="vertical" flexItem />}
        >
          <Metric
            label="QR codes"
            value={(totals.qrCodes ?? 0).toLocaleString()}
            sub={`in the last ${data?.days ?? days} days`}
          />
          <Metric label="Total value" value={compactPeso(totals.totalAmount)} sub="all statuses" />
          <Metric
            label="Settled"
            value={compactPeso(totals.paidAmount)}
            sub={`${(totals.paidCount ?? 0).toLocaleString()} paid`}
          />
          <Metric
            label="Conversion"
            value={`${Math.round((totals.conversionRate ?? 0) * 100)}%`}
            sub="paid vs created"
          />
          <Metric label="Branches" value={(totals.branches ?? 0).toLocaleString()} />
          {totals.users !== null && totals.users !== undefined && (
            <Metric label="Users" value={totals.users.toLocaleString()} />
          )}
        </Stack>
      </Paper>

      {/* Trends and detail sit below the actionable content */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={8}>
          <Panel title="QR codes created" action={<Chip size="small" label={`${data?.days ?? days} days`} />}>
            <AreaChart data={data?.series ?? []} valueKey="count" height={240} />
          </Panel>
        </Grid>

        <Grid item xs={12} md={4}>
          <Panel title="By status">
            <DonutChart data={data?.statusBreakdown ?? []} height={180} />
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel
            title="Top branches"
            action={
              <Button component={RouterLink} to={routes.qrList} size="small" endIcon={<ArrowIcon />}>
                All QR codes
              </Button>
            }
          >
            <BarList
              data={data?.topBranches ?? []}
              labelKey="branch_name"
              valueKey="count"
              formatValue={(v) => `${v.toLocaleString()} QR`}
            />
          </Panel>
        </Grid>

        <Grid item xs={12} md={6}>
          <Panel title="Recent activity">
            {(data?.recent ?? []).length === 0 ? (
              <Typography variant="body2" color="text.disabled">Nothing yet</Typography>
            ) : (
              data.recent.map((row) => (
                <Stack
                  key={row.id}
                  direction="row" alignItems="center" justifyContent="space-between"
                  spacing={1} py={1}
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
                  <Stack direction="row" alignItems="center" spacing={1.5} flexShrink={0}>
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
                  </Stack>
                </Stack>
              ))
            )}
          </Panel>
        </Grid>
      </Grid>
    </Container>
  );
};

export default OverView;
