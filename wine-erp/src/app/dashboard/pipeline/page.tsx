import { redirect } from 'next/navigation'

export default async function PipelinePage() {
    redirect('/dashboard/crm?tab=pipeline')
}
