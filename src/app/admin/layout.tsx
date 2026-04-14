import AdminLayout from '@/components/AdminLayout';

export const metadata = {
  title: 'Admin — Cuemath Screener',
  description: 'Cuemath AI Tutor Screener admin dashboard.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
