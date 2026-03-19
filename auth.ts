import NextAuth, { type NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

import { prisma } from './app/lib/prisma';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: false,
    }),
    Credentials({
      name: 'Email y contraseña',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email ? normalizeEmail(credentials.email) : '';
        const password = credentials?.password ?? '';
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return user;
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Bootstrap admin role via env
      const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
      if (owner && user.email && user.email.toLowerCase() === owner) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { role: 'ADMIN' },
          });
        } catch {
          // ignore
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      const userId = (user?.id as string | undefined) ?? (token.id as string | undefined);
      if (!userId) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, status: true, referralCode: true, pointsBalance: true },
      });

      token.id = userId;
      token.role = (dbUser?.role ?? 'USER') as 'USER' | 'ADMIN';
      token.status = (dbUser?.status ?? 'INTERESADO') as
        | 'INTERESADO'
        | 'FASE_1'
        | 'PROCESO_ACTIVO'
        | 'EGRESADO';
      token.referralCode = dbUser?.referralCode ?? null;
      token.pointsBalance = dbUser?.pointsBalance ?? 0;

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? '');
        session.user.role = (token.role ?? 'USER') as 'USER' | 'ADMIN';
        session.user.status = (token.status ?? 'INTERESADO') as
          | 'INTERESADO'
          | 'FASE_1'
          | 'PROCESO_ACTIVO'
          | 'EGRESADO';
        session.user.referralCode = (token.referralCode ?? null) as string | null;
        session.user.pointsBalance = Number(token.pointsBalance ?? 0);
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Ensure referralCode exists for OAuth-created users
      if (!user.id) return;
      const existing = await prisma.user.findUnique({ where: { id: user.id } });
      if (existing?.referralCode) return;

      // Retry a few times in case of unique collision
      for (let i = 0; i < 3; i++) {
        const code = nanoid(10);
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { referralCode: code },
          });
          break;
        } catch {
          // try again
        }
      }
    },
  },
};

export const auth = () => getServerSession(authOptions);

// Route handler for App Router (GET/POST) is defined in app/api/auth/[...nextauth]/route.ts

