import { prisma } from '@/app/lib/prisma';

const DEFAULT_EDITIONS = [
  {
    slug: 'edicion-5',
    title: 'Edicion 5',
    sequence: 5,
    isCurrent: true,
    notes: 'Edicion en curso',
  },
  {
    slug: 'edicion-6',
    title: 'Edicion 6',
    sequence: 6,
    isCurrent: false,
    notes: 'Edicion proxima con pagos anticipados',
  },
] as const;

export async function ensureDefaultEditions() {
  await Promise.all(
    DEFAULT_EDITIONS.map((edition) =>
      prisma.edition.upsert({
        where: { slug: edition.slug },
        update: {
          title: edition.title,
          sequence: edition.sequence,
          notes: edition.notes,
        },
        create: edition,
      })
    )
  );
}
