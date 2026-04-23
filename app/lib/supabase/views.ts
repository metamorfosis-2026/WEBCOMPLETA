import { ensureDefaultEditions } from '@/app/lib/editions';

import {
  getReferredUser,
  getUserById,
  listEditions,
  listEnrollments,
  listPayments,
  listPointsTransactionsByUserId,
  listReferralsByUserIds,
  listStatusEventsByUserId,
  listUsers,
} from './db';

export async function getDashboardData(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const [referredBy, referrals, statusEvents, pointsTransactions, enrollments, editions, payments] =
    await Promise.all([
      getReferredUser(user.referredById),
      listReferralsByUserIds([user.id]),
      listStatusEventsByUserId(user.id, 8),
      listPointsTransactionsByUserId(user.id, 8),
      listEnrollments(),
      listEditions(),
      listPayments(),
    ]);

  const level1 = referrals.slice(0, 50);
  const level2 = await listReferralsByUserIds(level1.map((entry) => entry.id));
  const level2ByParent = new Map<string, typeof level2>();
  for (const item of level2) {
    const bucket = level2ByParent.get(item.referredById ?? '') ?? [];
    bucket.push(item);
    level2ByParent.set(item.referredById ?? '', bucket);
  }

  const userEnrollments = enrollments.filter((entry) => entry.userId === user.id);
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const paymentsByEnrollmentId = new Map<string, typeof payments>();
  for (const payment of payments) {
    const bucket = paymentsByEnrollmentId.get(payment.enrollmentId) ?? [];
    bucket.push(payment);
    paymentsByEnrollmentId.set(payment.enrollmentId, bucket);
  }

  return {
    ...user,
    referredBy,
    referrals: level1.map((entry) => ({
      ...entry,
      referrals: (level2ByParent.get(entry.id) ?? []).slice(0, 25),
    })),
    statusEvents,
    pointsTransactions,
    enrollments: userEnrollments.map((enrollment) => ({
      ...enrollment,
      edition: editionById.get(enrollment.editionId)!,
      payments: (paymentsByEnrollmentId.get(enrollment.id) ?? []).slice(0, 10),
    })),
  };
}

export async function getAdminData() {
  await ensureDefaultEditions();

  const [users, editions, enrollments, payments] = await Promise.all([
    listUsers(),
    listEditions(),
    listEnrollments(),
    listPayments(),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const paymentsByEnrollmentId = new Map<string, typeof payments>();
  for (const payment of payments) {
    const bucket = paymentsByEnrollmentId.get(payment.enrollmentId) ?? [];
    bucket.push(payment);
    paymentsByEnrollmentId.set(payment.enrollmentId, bucket);
  }

  const hydratedUsers = users.map((user) => ({
    ...user,
    referredBy: user.referredById ? userById.get(user.referredById) ?? null : null,
    enrollments: enrollments
      .filter((entry) => entry.userId === user.id)
      .map((entry) => ({
        ...entry,
        edition: editionById.get(entry.editionId)!,
      })),
  }));

  const hydratedEditions = editions
    .sort((left, right) => {
      if (left.isCurrent === right.isCurrent) return left.sequence - right.sequence;
      return left.isCurrent ? -1 : 1;
    })
    .map((edition) => ({
      ...edition,
      enrollments: enrollments
        .filter((entry) => entry.editionId === edition.id)
        .map((entry) => ({
          ...entry,
          user: {
            ...userById.get(entry.userId)!,
            referredBy: (() => {
              const owner = userById.get(entry.userId)!;
              return owner.referredById ? userById.get(owner.referredById) ?? null : null;
            })(),
          },
          payments: paymentsByEnrollmentId.get(entry.id) ?? [],
        })),
    }));

  return {
    users: hydratedUsers,
    editions: hydratedEditions,
  };
}
