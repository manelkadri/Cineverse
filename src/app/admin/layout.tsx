import React from 'react';
import { notFound, redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { supportAdminStatus } from '@/lib/support-admin';

// Every /admin page is rendered inside this layout, and the check is made here on the server, on every request: signed out ->
// the login; not a support administrator -> the ordinary "not found" page (the admin area's existence is not revealed); the
// check itself failing -> a closed error page, never the administration. Only a confirmed administrator gets the sidebar.
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await authenticatedContext();
  if (!context) redirect('/login');
  const status = await supportAdminStatus(context.userId);
  if (status === 'not-admin') notFound();
  if (status === 'unavailable') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#08090D] px-4 text-center text-white" data-testid="admin-unverified">
        <div className="max-w-md">
          <h1 className="text-2xl font-extrabold">Vérification impossible</h1>
          <p role="alert" className="mt-3 text-sm text-[#a9a9b1]">Vos droits d’accès n’ont pas pu être vérifiés pour le moment : il s’agit d’une erreur du serveur, pas d’un refus. L’accès reste fermé tant que la vérification échoue.</p>
          <a href="/admin/support" className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover">Réessayer</a>
        </div>
      </main>
    );
  }
  let name = 'Administrateur';
  let email = '';
  try {
    const user = await prisma.user.findUnique({ where: { id: context.userId }, select: { name: true, email: true } });
    name = user?.name ?? name;
    email = user?.email ?? '';
  } catch { /* the header falls back to a generic label */ }
  return <AdminShell name={name} email={email}>{children}</AdminShell>;
}
