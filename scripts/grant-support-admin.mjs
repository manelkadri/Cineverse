/* global process, console */
// Grants (or revokes) support-staff access to ONE existing CINEVERSE account, by e-mail address.
//
//   node scripts/grant-support-admin.mjs owner@example.com            grant
//   node scripts/grant-support-admin.mjs owner@example.com --revoke   revoke
//
// This is the only way to become support staff: there is no button, route or setting in the app for it, and ordinary
// accounts can never promote themselves. It talks to the database named by DATABASE_URL (read from .env.local when the
// variable is not already set) and prints no credentials. The account must already exist (register it first).
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const [email, flag] = process.argv.slice(2);
if (!email || !email.includes('@') || (flag && flag !== '--revoke')) {
  console.error('Usage: node scripts/grant-support-admin.mjs <account e-mail> [--revoke]');
  process.exit(2);
}

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const prisma = new PrismaClient();
try {
  const grant = flag !== '--revoke';
  const result = await prisma.user.updateMany({ where: { email: email.trim().toLowerCase() }, data: { isSupportAdmin: grant } });
  if (result.count === 0) {
    console.error('No account with this e-mail address. Register it first, then run this script again.');
    process.exitCode = 1;
  } else {
    console.log(grant ? 'Support access granted to this account.' : 'Support access revoked for this account.');
  }
} catch (error) {
  console.error('Could not update the account:', String(error?.message ?? error).split('\n').pop());
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
