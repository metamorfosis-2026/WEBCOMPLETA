import { ensureDefaultEditions } from '@/app/lib/editions';

import {
  getReferredUser,
  getUserById,
  getUserGodAssignmentByUserId,
  listEditions,
  listEditionPhases,
  listEnrollments,
  listGiftInvitations,
  listGreekGods,
  listNewsPosts,
  listPayments,
  listPointsTransactionsByUserId,
  listReferralsByUserIds,
  listStatusEventsByUserId,
  listUserAchievements,
  listUserAchievementsByUserId,
  listUserGodAssignments,
  listUsers,
  listWeeklyTasks,
} from './db';

export async function getDashboardData(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const [
    referredBy,
    referrals,
    statusEvents,
    pointsTransactions,
    enrollments,
    editions,
    phases,
    payments,
    giftInvitations,
    weeklyTasks,
    newsPosts,
    gods,
    godAssignment,
    manualAchievements,
  ] = await Promise.all([
    getReferredUser(user.referredById),
    listReferralsByUserIds([user.id]),
    listStatusEventsByUserId(user.id, 8),
    listPointsTransactionsByUserId(user.id, 8),
    listEnrollments(),
    listEditions(),
    listEditionPhases(),
    listPayments(),
    listGiftInvitations(),
    listWeeklyTasks(),
    listNewsPosts(),
    listGreekGods(),
    getUserGodAssignmentByUserId(user.id),
    listUserAchievementsByUserId(user.id),
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
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const paymentsByEnrollmentId = new Map<string, typeof payments>();
  for (const payment of payments) {
    const bucket = paymentsByEnrollmentId.get(payment.enrollmentId) ?? [];
    bucket.push(payment);
    paymentsByEnrollmentId.set(payment.enrollmentId, bucket);
  }
  const userGiftInvitations = giftInvitations.filter((entry) => entry.giverUserId === user.id);

  const now = Date.now();
  const visibleNews = newsPosts.filter((post) => {
    if (!post.isPublished) return false;
    if (post.startsAt && new Date(post.startsAt).getTime() > now) return false;
    if (post.endsAt && new Date(post.endsAt).getTime() < now) return false;
    return true;
  });

  const userPhaseSequences = new Set<number>();
  for (const entry of userEnrollments) {
    const phase = entry.phaseId ? phaseById.get(entry.phaseId) : null;
    if (phase) userPhaseSequences.add(phase.sequence);
  }

  const tasksForUser = weeklyTasks
    .filter((task) => task.isPublished)
    .filter((task) => {
      if (task.assignedUserId) return task.assignedUserId === user.id;
      if (task.phaseSequence != null) return userPhaseSequences.has(task.phaseSequence);
      return false;
    })
    .map((task) => ({
      ...task,
      edition: task.editionId ? editionById.get(task.editionId) ?? null : null,
      phase: task.phaseId ? phaseById.get(task.phaseId) ?? null : null,
    }));

  const godById = new Map(gods.map((god) => [god.id, god]));
  const assignedGod = godAssignment ? godById.get(godAssignment.godId) ?? null : null;

  const derivedAchievements = userEnrollments
    .filter((entry) => String(entry.status).toUpperCase() === 'FINALIZADO')
    .map((entry) => {
      const edition = editionById.get(entry.editionId);
      const phase = entry.phaseId ? phaseById.get(entry.phaseId) : null;
      const editionTitle = edition?.title ?? 'esta edicion';

      let title: string;
      let description: string;

      switch (phase?.sequence) {
        case 1:
          title = `Te felicitamos! Completaste Fase 1 de ${editionTitle}`;
          description =
            'Diste el primer gran paso del proceso. Estamos orgullosos del trabajo que ya hiciste y de que sigas eligiendo transformarte. Lo mejor recien empieza.';
          break;
        case 2:
          title = `Avanzaste! Fase 2 completada en ${editionTitle}`;
          description =
            'Esta etapa requiere coraje, profundidad y entrega. Que la hayas atravesado dice muchisimo de vos. Lo mejor sigue adelante.';
          break;
        case 3:
          title = `Egresaste de ${editionTitle}!`;
          description =
            'Llegaste al final de este recorrido. Hoy sos una version nueva de vos. Estamos profundamente orgullosos de haberte acompañado. Que lo aprendido te sostenga y te impulse.';
          break;
        default:
          title = phase
            ? `Bien hecho! Completaste ${phase.title} de ${editionTitle}`
            : `Bien hecho! Terminaste una etapa de ${editionTitle}`;
          description =
            'Cada cierre es un paso hacia tu mejor version. Te felicitamos por llegar hasta aca.';
      }

      return {
        id: `derived-${entry.id}`,
        kind: 'DERIVED' as const,
        title,
        description,
        icon: null as string | null,
        awardedAt: entry.updatedAt,
        edition: edition ?? null,
        phase: phase ?? null,
      };
    });

  const manualAchievementsHydrated = manualAchievements.map((entry) => ({
    id: entry.id,
    kind: 'MANUAL' as const,
    title: entry.title,
    description: entry.description,
    icon: entry.icon,
    awardedAt: entry.awardedAt,
    edition: entry.editionId ? editionById.get(entry.editionId) ?? null : null,
    phase: entry.phaseId ? phaseById.get(entry.phaseId) ?? null : null,
  }));

  const allAchievements = [...manualAchievementsHydrated, ...derivedAchievements].sort(
    (left, right) => new Date(right.awardedAt).getTime() - new Date(left.awardedAt).getTime()
  );

  return {
    ...user,
    referredBy,
    referrals: level1.map((entry) => ({
      ...entry,
      referrals: (level2ByParent.get(entry.id) ?? []).slice(0, 25),
    })),
    statusEvents,
    pointsTransactions,
    giftInvitations: userGiftInvitations.map((invitation) => ({
      ...invitation,
      edition: editionById.get(invitation.editionId) ?? null,
    })),
    enrollments: userEnrollments.map((enrollment) => ({
      ...enrollment,
      edition: editionById.get(enrollment.editionId)!,
      phase: enrollment.phaseId ? phaseById.get(enrollment.phaseId) ?? null : null,
      payments: (paymentsByEnrollmentId.get(enrollment.id) ?? []).slice(0, 10),
    })),
    newsPosts: visibleNews,
    weeklyTasks: tasksForUser,
    godAssignment: assignedGod
      ? {
          ...godAssignment!,
          god: assignedGod,
        }
      : null,
    achievements: allAchievements,
  };
}

export async function getAdminData() {
  await ensureDefaultEditions();

  const [
    users,
    editions,
    phases,
    enrollments,
    payments,
    giftInvitations,
    weeklyTasks,
    newsPosts,
    gods,
    godAssignments,
    manualAchievements,
  ] = await Promise.all([
    listUsers(),
    listEditions(),
    listEditionPhases(),
    listEnrollments(),
    listPayments(),
    listGiftInvitations(),
    listWeeklyTasks(),
    listNewsPosts(),
    listGreekGods(),
    listUserGodAssignments(),
    listUserAchievements(),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const editionById = new Map(editions.map((edition) => [edition.id, edition]));
  const phaseById = new Map(phases.map((phase) => [phase.id, phase]));
  const paymentsByEnrollmentId = new Map<string, typeof payments>();
  for (const payment of payments) {
    const bucket = paymentsByEnrollmentId.get(payment.enrollmentId) ?? [];
    bucket.push(payment);
    paymentsByEnrollmentId.set(payment.enrollmentId, bucket);
  }

  const godById = new Map(gods.map((god) => [god.id, god]));
  const assignmentByUserId = new Map(godAssignments.map((assignment) => [assignment.userId, assignment]));
  const achievementsByUserId = new Map<string, typeof manualAchievements>();
  for (const achievement of manualAchievements) {
    const bucket = achievementsByUserId.get(achievement.userId) ?? [];
    bucket.push(achievement);
    achievementsByUserId.set(achievement.userId, bucket);
  }

  const hydratedUsers = users.map((user) => {
    const assignment = assignmentByUserId.get(user.id) ?? null;
    const userEnrollments = enrollments.filter((entry) => entry.userId === user.id);
    const userPayments = userEnrollments.flatMap(
      (entry) => paymentsByEnrollmentId.get(entry.id) ?? []
    );
    const userManualAchievements = (achievementsByUserId.get(user.id) ?? []).map((entry) => ({
      ...entry,
      edition: entry.editionId ? editionById.get(entry.editionId) ?? null : null,
      phase: entry.phaseId ? phaseById.get(entry.phaseId) ?? null : null,
    }));
    return {
      ...user,
      referredBy: user.referredById ? userById.get(user.referredById) ?? null : null,
      enrollments: userEnrollments.map((entry) => ({
        ...entry,
        edition: editionById.get(entry.editionId)!,
        phase: entry.phaseId ? phaseById.get(entry.phaseId) ?? null : null,
        payments: paymentsByEnrollmentId.get(entry.id) ?? [],
      })),
      payments: userPayments,
      godAssignment: assignment
        ? { ...assignment, god: godById.get(assignment.godId) ?? null }
        : null,
      achievements: userManualAchievements,
    };
  });

  const hydratedEditions = editions
    .sort((left, right) => {
      if (left.isCurrent === right.isCurrent) return left.sequence - right.sequence;
      return left.isCurrent ? -1 : 1;
    })
    .map((edition) => ({
      ...edition,
      phases: phases
        .filter((phase) => phase.editionId === edition.id)
        .sort((left, right) => left.sequence - right.sequence),
      enrollments: enrollments
        .filter((entry) => entry.editionId === edition.id)
        .map((entry) => ({
          ...entry,
          phase: entry.phaseId ? phaseById.get(entry.phaseId) ?? null : null,
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

  const hydratedGiftInvitations = giftInvitations.map((invitation) => ({
    ...invitation,
    edition: editionById.get(invitation.editionId) ?? null,
    giver: userById.get(invitation.giverUserId) ?? null,
  }));

  const hydratedWeeklyTasks = weeklyTasks.map((task) => ({
    ...task,
    edition: task.editionId ? editionById.get(task.editionId) ?? null : null,
    phase: task.phaseId ? phaseById.get(task.phaseId) ?? null : null,
    assignedUser: task.assignedUserId ? userById.get(task.assignedUserId) ?? null : null,
  }));

  const hydratedNewsPosts = newsPosts.map((post) => ({
    ...post,
    edition: post.editionId ? editionById.get(post.editionId) ?? null : null,
    phase: post.phaseId ? phaseById.get(post.phaseId) ?? null : null,
    createdBy: post.createdById ? userById.get(post.createdById) ?? null : null,
  }));

  return {
    users: hydratedUsers,
    editions: hydratedEditions,
    giftInvitations: hydratedGiftInvitations,
    weeklyTasks: hydratedWeeklyTasks,
    newsPosts: hydratedNewsPosts,
    gods,
    godAssignments,
  };
}
