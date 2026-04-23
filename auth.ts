import { cache } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';

import {
  normalizeEmail,
  normalizeUserStatus,
} from './app/lib/metamorfosis';
import { hasSupabaseAdminEnv, hasSupabaseEnv } from './app/lib/supabase/config';
import { createClient } from './app/lib/supabase/server';
import {
  generateReferralCode,
  getUserByAuthIdOrEmail,
  getUserByReferralCode,
  resolveRole,
  updateUser,
  createUser,
} from './app/lib/supabase/db';

function getDisplayName(user: SupabaseAuthUser) {
  const metadataName =
    user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.user_metadata?.user_name ?? null;
  const normalized = String(metadataName ?? '').trim();
  return normalized || null;
}

async function resolveReferralUserId(refCode?: string | null, excludedUserId?: string | null) {
  const normalizedRefCode = String(refCode ?? '').trim();
  if (!normalizedRefCode) return null;

  const referrer = await getUserByReferralCode(normalizedRefCode);

  if (!referrer) return null;
  if (excludedUserId && referrer.id === excludedUserId) return null;

  return referrer.id;
}

async function upsertAppUserFromSupabaseUser(user: SupabaseAuthUser, refCode?: string | null) {
  const email = normalizeEmail(user.email);
  if (!email) return null;

  const existing = await getUserByAuthIdOrEmail(user.id, email);

  const role = resolveRole(email, existing?.role);
  const referredById =
    existing?.referredById ?? (await resolveReferralUserId(refCode, existing?.id ?? null));

  const data = {
    supabase_auth_id: user.id,
    email,
    name: getDisplayName(user) ?? existing?.name ?? null,
    image: String(user.user_metadata?.avatar_url ?? existing?.image ?? '') || null,
    email_verified: user.email_confirmed_at ?? (existing?.emailVerified?.toISOString() ?? null),
    role,
    status: normalizeUserStatus(existing?.status),
    referral_code: existing?.referralCode ?? (await generateReferralCode()),
    referred_by_id: referredById,
  };

  if (existing) {
    const hasChanges =
      existing.supabaseAuthId !== data.supabase_auth_id ||
      existing.email !== data.email ||
      existing.name !== data.name ||
      existing.image !== data.image ||
      String(existing.emailVerified?.toISOString() ?? '') !== String(data.email_verified ?? '') ||
      existing.role !== data.role ||
      existing.status !== data.status ||
      existing.referralCode !== data.referral_code ||
      existing.referredById !== data.referred_by_id;

    if (!hasChanges) {
      return existing;
    }

    return updateUser(existing.id, data);
  }

  return createUser({
    ...data,
    points_balance: 0,
  });
}

export async function syncSupabaseAuthUser(user: SupabaseAuthUser, options?: { refCode?: string | null }) {
  if (!user?.email) return null;
  return upsertAppUserFromSupabaseUser(user, options?.refCode);
}

export async function syncAuthenticatedUser(options?: { refCode?: string | null }) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) return null;

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
      role: appUser.role,
      status: appUser.status,
      referralCode: appUser.referralCode ?? null,
      pointsBalance: appUser.pointsBalance ?? 0,
    },
  };
});
