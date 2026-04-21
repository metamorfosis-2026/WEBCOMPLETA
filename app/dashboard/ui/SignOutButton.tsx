import { redirect } from 'next/navigation';

import { createClient } from '@/app/lib/supabase/server';

async function signOut() {
  'use server';

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/90 transition hover:bg-white/10"
      >
        Salir
      </button>
    </form>
  );
}
