import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUserFromToken, SESSION_COOKIE } from './auth';
import { activeMembership } from './membership';

export function pageAccount() {
  return getSessionUserFromToken(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireMemberPage() {
  const account = await pageAccount();
  if (!account || !(await activeMembership(account.id).catch(() => null))) redirect('/membership');
}
