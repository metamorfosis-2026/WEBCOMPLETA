import { NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

import { prisma } from '@/app/lib/prisma';

const RegisterSchema = z.object({
  name: z.string().min(3).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  ref: z.string().min(4).max(32).optional(),
});

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const REF_REGISTER_POINTS = 10;

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const input = RegisterSchema.parse(json);

    const email = normalizeEmail(input.email);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'EMAIL_IN_USE' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const referredBy = input.ref
      ? await prisma.user.findUnique({ where: { referralCode: input.ref } })
      : null;

    const referralCode = nanoid(10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: input.name.trim(),
          email,
          passwordHash,
          referralCode,
          referredById: referredBy?.id ?? null,
        },
      });

      // Puntos para el referente (ética: reconocimiento simbólico)
      if (referredBy?.id) {
        await tx.pointsTransaction.create({
          data: {
            userId: referredBy.id,
            points: REF_REGISTER_POINTS,
            reason: 'referral_register',
            metadata: JSON.stringify({ referredUserId: user.id }),
          },
        });

        await tx.user.update({
          where: { id: referredBy.id },
          data: { pointsBalance: { increment: REF_REGISTER_POINTS } },
        });
      }

      return user;
    });

    return NextResponse.json({ ok: true, userId: created.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'INVALID_INPUT', details: err.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: false, error: 'UNKNOWN' }, { status: 500 });
  }
}
