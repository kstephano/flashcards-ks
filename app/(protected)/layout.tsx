import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Header } from '@/components/layout/Header';
import { JobStatusPanel } from '@/components/layout/JobStatusPanel';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Header />
      <main className="flex-1 w-full">{children}</main>
      <JobStatusPanel />
    </div>
  );
}
