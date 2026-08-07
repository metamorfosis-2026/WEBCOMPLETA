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
        className="inline-flex h-10 items-center justify-center rounded-xl border border-ivory/12 bg-ivory/[0.05] px-4 text-xs font-bold uppercase tracking-[0.12em] text-ivory/70 transition duration-300 hover:border-ivory/30 hover:text-ivory"
      >
        Salir
      </button>
    </form>
  );
}
