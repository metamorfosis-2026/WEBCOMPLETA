import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'USER' | 'ADMIN';
      status: 'INTERESADO' | 'FASE_1' | 'PROCESO_ACTIVO' | 'EGRESADO';
      referralCode: string | null;
      pointsBalance: number;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'USER' | 'ADMIN';
    status?: 'INTERESADO' | 'FASE_1' | 'PROCESO_ACTIVO' | 'EGRESADO';
    referralCode?: string | null;
    pointsBalance?: number;
  }
}
