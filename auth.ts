import { cache } from 'react';
import { nanoid } from 'nanoid';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import { prisma } from './app/lib/prisma';
import {
  DEFAULT_SUPERADMIN_EMAIL,
  normalizeEmail,
  normalizeRole,
  normalizeUserStatus,
} from './app/lib/metamorfosis';
import { hasSupabaseEnv } from './app/lib/supabase/config';
import { createClient } from './app/lib/supabase/server';

function getAdminEmails() {
  const emails = new Set<string>();

  for (const email of (process.env.ADMIN_EMAILS ?? '').split(',')) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }

  return emails;
}

function getSuperadminEmails() {
  const emails = new Set<string>([DEFAULT_SUPERADMIN_EMAIL]);

  const owner = normalizeEmail(process.env.OWNER_EMAIL);
  if (owner) emails.add(owner);

  for (const email of (process.env.SUPERADMIN_EMAILS ?? '').split(',')) {
    const normalized = normalizeEmail(email);
    if (normalized) emails.add(normalized);
  }

  return emails;
}

function getConfiguredRole(email: string) {
  if (getSuperadminEmails().has(email)) return 'SUPERADMIN' as const;
  if (getAdminEmails().has(email)) return 'ADMIN' as const;
  return null;
}

function getDisplayName(user: SupabaseAuthUser) {
  const metadataName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.user_metadata?.user_name ?? null;
  const normalized = String(metadataName ?? '').trim();
  return normalized || null;
}

async function generateReferralCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = nanoid(10);
    const existing = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });

    if (!existing) return code;
  }

  throw new Error('REFERRAL_CODE_GENERATION_FAILED');
}

async function resolveReferralUserId(refCode?: string | null, excludedUserId?: string | null) {
  const normalizedRefCode = String(refCode ?? '').trim();
  if (!normalizedRefCode) return null;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: normalizedRefCode },
    select: { id: true },
  });

  if (!referrer?.id) return null;
  if (excludedUserId && referrer.id === excludedUserId) return null;

  return referrer.id;
}

function resolveRole(email: string, currentRole?: string | null) {
  const configuredRole = getConfiguredRole(email);
  if (configuredRole) return configuredRole;

  const normalizedCurrent = normalizeRole(currentRole);
  if (normalizedCurrent === 'SUPERADMIN' || normalizedCurrent === 'ADMIN') {
    return normalizedCurrent;
  }

  return 'USER' as const;
}

async function upsertAppUserFromSupabaseUser(user: SupabaseAuthUser, refCode?: string | null) {
  const email = normalizeEmail(user.email);
  if (!email) return null;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ supabaseAuthId: user.id }, { email }],
    },
  });

  const role = resolveRole(email, existing?.role);
  const referredById =
    existing?.referredById ?? (await resolveReferralUserId(refCode, existing?.id ?? null));

  const data = {
    supabaseAuthId: user.id,
    email,
    name: getDisplayName(user) ?? existing?.name ?? null,
    image: String(user.user_metadata?.avatar_url ?? existing?.image ?? '') || null,
    emailVerified: user.email_confirmed_at ? new Date(user.email_confirmed_at) : existing?.emailVerified ?? null,
    role,
    status: normalizeUserStatus(existing?.status),
    referralCode: existing?.referralCode ?? (await generateReferralCode()),
    referredById,
  };

  if (existing) {
    const hasChanges =
      existing.supabaseAuthId !== data.supabaseAuthId ||
      existing.email !== data.email ||
      existing.name !== data.name ||
      existing.image !== data.image ||
      String(existing.emailVerified ?? '') !== String(data.emailVerified ?? '') ||
      existing.role !== data.role ||
      existing.status !== data.status ||
      existing.referralCode !== data.referralCode ||
      existing.referredById !== data.referredById;

    if (!hasChanges) {
      return existing;
    }

    return prisma.user.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.user.create({
    data: {
      ...data,
      pointsBalance: 0,
    },
  });
}

export async function syncSupabaseAuthUser(user: SupabaseAuthUser, options?: { refCode?: string | null }) {
  if (!user?.email) return null;
  return upsertAppUserFromSupabaseUser(user, options?.refCode);
}

export async function syncAuthenticatedUser(options?: { refCode?: string | null }) {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return null;

  return syncSupabaseAuthUser(user, options);
}

export const auth = cache(async () => {
  const appUser = await syncAuthenticatedUser();
  if (!appUser) return null;

  return {
    user: {
      id: appUser.id,
      supabaseAuthId: appUser.supabaseAuthId,
      name: appUser.name,
      email: appUser.email,
      image: appUser.image,
      role: normalizeRole(appUser.role),
      status: normalizeUserStatus(appUser.status),
      referralCode: appUser.referralCode ?? null,
      pointsBalance: appUser.pointsBalance ?? 0,
    },
  };
});
