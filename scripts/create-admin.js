const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function main() {
  const emailRaw = process.env.ADMIN_EMAIL;
  const passwordRaw = process.env.ADMIN_PASSWORD;
  const nameRaw = process.env.ADMIN_NAME;

  const email = normalizeEmail(emailRaw);
  const password = String(passwordRaw || '');
  const name = nameRaw ? String(nameRaw).trim() : 'Super Admin';

  if (!email) {
    throw new Error('Missing ADMIN_EMAIL env var');
  }
  if (!password || password.length < 8) {
    throw new Error('Missing ADMIN_PASSWORD (min 8 chars) env var');
  }

  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: existing.name ?? name,
          passwordHash,
          role: 'ADMIN',
          referralCode: existing.referralCode ?? nanoid(10),
        },
      });

      console.log(`Admin updated: ${email}`);
      return;
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        status: 'INTERESADO',
        referralCode: nanoid(10),
      },
    });

    console.log(`Admin created: ${email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
