import { fn, col, literal, Op } from 'sequelize';
import models from '../model/index.js';
import { cached } from '../utils/cache.js';
import { resolveTenantAdminId, branchScopeFor } from '../utils/scope.js';

const { QrCode, Branch, User } = models;

// Dashboard numbers do not need to be exact to the second, and this endpoint is
// hit on every page load. A short TTL turns a burst of loads into one query set.
const DASHBOARD_TTL_MS = 60 * 1000;

const MAX_SERIES_DAYS = 365;
const DEFAULT_SERIES_DAYS = 30;

const toNumber = (value) => (value === null || value === undefined ? 0 : Number(value));

/**
 * Every figure on the dashboard in one cached response, scoped to the caller's
 * tenant and - for branch users - their branch.
 */
const getDashboardAnalytics = async (req, res) => {
  try {
    const adminId = resolveTenantAdminId(req.user);
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is missing from the request' });
    }

    const scope = await branchScopeFor(req.user);
    if (scope === null) {
      return res.status(403).json({ error: 'You are not assigned to any branch.' });
    }

    const days = Math.min(
      Math.max(parseInt(req.query.days, 10) || DEFAULT_SERIES_DAYS, 1),
      MAX_SERIES_DAYS
    );

    const branchKey = scope.branch_id || 'all';
    const cacheKey = `analytics:${adminId}:${branchKey}:${days}`;

    const payload = await cached(cacheKey, DASHBOARD_TTL_MS, async () => {
      const where = { admin_id: adminId, ...scope };

      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);

      // Fired together: these are independent aggregates over the same table.
      const [statusRows, seriesRows, topBranchRows, branchCount, userCount, recent] =
        await Promise.all([
          QrCode.findAll({
            where,
            attributes: [
              'status',
              [fn('COUNT', col('id')), 'count'],
              [fn('COALESCE', fn('SUM', col('amount')), 0), 'amount'],
            ],
            group: ['status'],
            raw: true,
          }),

          QrCode.findAll({
            where: { ...where, createdAt: { [Op.gte]: since } },
            attributes: [
              [fn('DATE', col('created_at')), 'date'],
              [fn('COUNT', col('id')), 'count'],
              [fn('COALESCE', fn('SUM', col('amount')), 0), 'amount'],
            ],
            group: [fn('DATE', col('created_at'))],
            order: [[fn('DATE', col('created_at')), 'ASC']],
            raw: true,
          }),

          // Branch users only ever see their own branch, so the ranking is moot.
          scope.branch_id
            ? Promise.resolve([])
            : QrCode.findAll({
                where,
                include: [{ model: Branch, as: 'branch', attributes: [] }],
                attributes: [
                  [col('branch.branch_name'), 'branch_name'],
                  [fn('COUNT', col('QrCode.id')), 'count'],
                  [fn('COALESCE', fn('SUM', col('QrCode.amount')), 0), 'amount'],
                ],
                group: [col('branch.branch_name')],
                order: [[literal('count'), 'DESC']],
                limit: 5,
                subQuery: false,
                raw: true,
              }),

          scope.branch_id
            ? Promise.resolve(1)
            : Branch.count({ where: { admin_id: adminId } }),

          scope.branch_id
            ? Promise.resolve(null)
            : User.count({ where: { admin_id: adminId } }),

          QrCode.findAll({
            where,
            attributes: ['id', 'payment_reference', 'amount', 'status', 'createdAt'],
            order: [['createdAt', 'DESC']],
            limit: 8,
            raw: true,
          }),
        ]);

      const statusBreakdown = statusRows.map((row) => ({
        status: row.status,
        count: toNumber(row.count),
        amount: toNumber(row.amount),
      }));

      const totals = statusBreakdown.reduce(
        (acc, row) => {
          acc.qrCodes += row.count;
          acc.totalAmount += row.amount;
          if (row.status === 'paid' || row.status === 'success') {
            acc.paidCount += row.count;
            acc.paidAmount += row.amount;
          }
          return acc;
        },
        { qrCodes: 0, totalAmount: 0, paidCount: 0, paidAmount: 0 }
      );

      // Fill gaps so the chart has one point per day rather than skipping
      // days with no activity.
      const byDate = new Map(
        seriesRows.map((row) => [
          String(row.date).slice(0, 10),
          { count: toNumber(row.count), amount: toNumber(row.amount) },
        ])
      );

      const series = [];
      for (let i = 0; i < days; i += 1) {
        const day = new Date(since);
        day.setDate(since.getDate() + i);
        const key = day.toISOString().slice(0, 10);
        const hit = byDate.get(key);
        series.push({ date: key, count: hit ? hit.count : 0, amount: hit ? hit.amount : 0 });
      }

      return {
        totals: {
          ...totals,
          branches: branchCount,
          users: userCount,
          conversionRate: totals.qrCodes ? totals.paidCount / totals.qrCodes : 0,
        },
        statusBreakdown,
        series,
        topBranches: topBranchRows.map((row) => ({
          branch_name: row.branch_name || 'Unassigned',
          count: toNumber(row.count),
          amount: toNumber(row.amount),
        })),
        recent: recent.map((row) => ({
          ...row,
          amount: toNumber(row.amount),
        })),
        days,
        generatedAt: new Date().toISOString(),
      };
    });

    // Lets the browser reuse the response too, cutting repeat calls further.
    res.set('Cache-Control', 'private, max-age=30');
    return res.json(payload);
  } catch (error) {
    console.error('Error building dashboard analytics:', error);
    return res.status(500).json({ error: 'Error building dashboard analytics' });
  }
};

export { getDashboardAnalytics };
