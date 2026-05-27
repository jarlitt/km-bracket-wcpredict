import { redirect } from 'next/navigation'
import { AdminPageClient } from './admin-page-client'
import { getAdminAccess } from '@/lib/admin/access'

export default async function AdminPage() {
  const access = await getAdminAccess()

  if (!access.ok) {
    redirect('/')
  }

  return <AdminPageClient />
}
