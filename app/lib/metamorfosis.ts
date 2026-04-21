export const DEFAULT_SUPERADMIN_EMAIL = 'gestiones.metamorfosis@gmail.com';

export const USER_STATUS_OPTIONS = ['INTERESADO', 'FASE_1', 'PROCESO_ACTIVO', 'EGRESADO'] as const;
export const ENROLLMENT_STATUS_OPTIONS = [
  'PENDIENTE',
  'RESERVADO',
  'CONFIRMADO',
  'CURSANDO',
  'FINALIZADO',
  'CANCELADO',
] as const;
export const PAYMENT_STATUS_OPTIONS = ['PENDIENTE', 'CONFIRMADO', 'CANCELADO', 'DEVUELTO'] as const;
export const PAYMENT_METHOD_OPTIONS = ['TRANSFERENCIA', 'EFECTIVO', 'MERCADO_PAGO', 'TARJETA', 'OTRO'] as const;

export type AppRole = 'USER' | 'ADMIN' | 'SUPERADMIN';
export type UserStatus = (typeof USER_STATUS_OPTIONS)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS_OPTIONS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHOD_OPTIONS)[number];

function normalizeEnumValue<T extends readonly string[]>(
  value: string | null | undefined,
  allowed: T,
  fallback: T[number]
): T[number] {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase();

  return (allowed as readonly string[]).includes(normalized) ? (normalized as T[number]) : fallback;
}

export function normalizeEmail(email: string | null | undefined) {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeRole(role: string | null | undefined): AppRole {
  return normalizeEnumValue(role, ['USER', 'ADMIN', 'SUPERADMIN'] as const, 'USER');
}

export function isAdminRole(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  return normalized === 'ADMIN' || normalized === 'SUPERADMIN';
}

export function isSuperadminRole(role: string | null | undefined) {
  return normalizeRole(role) === 'SUPERADMIN';
}

export function normalizeUserStatus(value: string | null | undefined): UserStatus {
  return normalizeEnumValue(value, USER_STATUS_OPTIONS, 'INTERESADO');
}

export function normalizeEnrollmentStatus(value: string | null | undefined): EnrollmentStatus {
  return normalizeEnumValue(value, ENROLLMENT_STATUS_OPTIONS, 'PENDIENTE');
}

export function normalizePaymentStatus(value: string | null | undefined): PaymentStatus {
  return normalizeEnumValue(value, PAYMENT_STATUS_OPTIONS, 'CONFIRMADO');
}

export function normalizePaymentMethod(value: string | null | undefined): PaymentMethod {
  return normalizeEnumValue(value, PAYMENT_METHOD_OPTIONS, 'TRANSFERENCIA');
}

export function statusLabel(status: string | null | undefined) {
  switch (normalizeUserStatus(status)) {
    case 'FASE_1':
      return 'Fase 1';
    case 'PROCESO_ACTIVO':
      return 'Proceso activo';
    case 'EGRESADO':
      return 'Egresado/a';
    case 'INTERESADO':
    default:
      return 'Interesado/a';
  }
}

export function roleLabel(role: string | null | undefined) {
  switch (normalizeRole(role)) {
    case 'SUPERADMIN':
      return 'Superadmin';
    case 'ADMIN':
      return 'Admin';
    case 'USER':
    default:
      return 'Participante';
  }
}

export function enrollmentStatusLabel(status: string | null | undefined) {
  switch (normalizeEnrollmentStatus(status)) {
    case 'RESERVADO':
      return 'Reservado/a';
    case 'CONFIRMADO':
      return 'Confirmado/a';
    case 'CURSANDO':
      return 'Cursando';
    case 'FINALIZADO':
      return 'Finalizado';
    case 'CANCELADO':
      return 'Cancelado';
    case 'PENDIENTE':
    default:
      return 'Pendiente';
  }
}

export function paymentStatusLabel(status: string | null | undefined) {
  switch (normalizePaymentStatus(status)) {
    case 'PENDIENTE':
      return 'Pendiente';
    case 'CANCELADO':
      return 'Cancelado';
    case 'DEVUELTO':
      return 'Devuelto';
    case 'CONFIRMADO':
    default:
      return 'Confirmado';
  }
}

export function paymentMethodLabel(method: string | null | undefined) {
  switch (normalizePaymentMethod(method)) {
    case 'MERCADO_PAGO':
      return 'Mercado Pago';
    case 'TRANSFERENCIA':
      return 'Transferencia';
    case 'EFECTIVO':
      return 'Efectivo';
    case 'TARJETA':
      return 'Tarjeta';
    case 'OTRO':
    default:
      return 'Otro';
  }
}

export function safeRedirectPath(path: string | null | undefined, fallback = '/dashboard') {
  const normalized = String(path ?? '').trim();
  if (!normalized.startsWith('/')) return fallback;
  if (normalized.startsWith('//')) return fallback;
  return normalized || fallback;
}

export function parseMoneyToCents(value: string | null | undefined) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '');
  let normalized = raw;

  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else {
    const dotMatches = normalized.match(/\./g) ?? [];
    if (dotMatches.length > 1) {
      normalized = normalized.replace(/\./g, '');
    }
  }

  if (!normalized) return 0;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('INVALID_MONEY');
  }

  return Math.round(parsed * 100);
}

export function formatMoney(amountInCents: number | null | undefined, currency = 'ARS') {
  const numeric = Number(amountInCents ?? 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(numeric / 100);
}

export function sumConfirmedPayments<
  T extends {
    amountCents: number;
    status: string;
  },
>(payments: T[]) {
  return payments.reduce((total, payment) => {
    return normalizePaymentStatus(payment.status) === 'CONFIRMADO'
      ? total + Number(payment.amountCents ?? 0)
      : total;
  }, 0);
}
