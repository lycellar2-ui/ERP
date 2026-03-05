import { redirect } from 'next/navigation'

// Root page — redirect to dashboard (middleware handles auth check)
export default function RootPage() {
  redirect('/dashboard')
}
