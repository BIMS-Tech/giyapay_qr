import models from '../model/index.js';

const { User } = models;

/**
 * Resolve the tenant whose data the caller may see. Admins own their own id;
 * Co-Admins and branch users inherit the parent admin_id carried in the token.
 */
export const resolveTenantAdminId = ({ userType, id, admin_id }) => {
  if (userType === 'admin') return id;
  return admin_id || null;
};

/**
 * Extra where-clause narrowing a branch user to their own branch.
 * Returns {} for roles that see the whole tenant, or null when a branch user
 * has no branch assigned - callers must treat null as "deny".
 *
 * branch_id is not carried in the JWT, so it is read from the user record.
 */
export const branchScopeFor = async (user) => {
  if (user.userType !== 'Branch User') return {};

  const record = await User.findByPk(user.id, { attributes: ['branch_id'], raw: true });
  if (!record || !record.branch_id) return null;

  return { branch_id: record.branch_id };
};
