import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function GMDashboard() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Welcome, {user.email}!
        </h1>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">GM Dashboard</h2>
          <p className="text-gray-600 mb-4">
            Campaign management and job generation coming soon...
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Make sure you've run the database migrations in your Supabase dashboard.
              Go to SQL Editor and run the files in <code>supabase/migrations/</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
