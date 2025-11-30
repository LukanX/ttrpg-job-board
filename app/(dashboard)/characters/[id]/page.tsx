import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function CharacterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: character, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !character) {
    notFound()
  }

  // Check ownership or permission (GMs can view if in campaign, but for now just owner)
  // The RLS policies handle the security, but we might want to handle the UI gracefully.
  // If RLS blocks it, we get an error.

  const stats = character.stats as any
  const attributes = stats.build?.attributes || {}
  const abilities = stats.build?.abilities || {}

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <Link href="/characters" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Characters
          </Link>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              {character.name}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Level {character.level} {character.ancestry} {character.class}
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl className="sm:divide-y sm:divide-gray-200">
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Heritage</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {stats.build?.heritage || 'N/A'}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Background</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  {stats.build?.background || 'N/A'}
                </dd>
              </div>
              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Key Ability</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 uppercase">
                  {stats.build?.keyability || 'N/A'}
                </dd>
              </div>
              
              {/* Ability Scores */}
              <div className="py-4 sm:py-5 sm:px-6">
                <dt className="text-sm font-medium text-gray-500 mb-2">Ability Scores</dt>
                <dd className="grid grid-cols-6 gap-4">
                  {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((ability) => (
                    <div key={ability} className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-xs font-bold text-gray-500 uppercase">{ability}</div>
                      <div className="text-lg font-semibold">{abilities[ability] || 10}</div>
                    </div>
                  ))}
                </dd>
              </div>

              <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                <dt className="text-sm font-medium text-gray-500">Raw Data</dt>
                <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                  <details>
                    <summary className="cursor-pointer text-blue-600">View JSON</summary>
                    <pre className="mt-2 bg-gray-100 p-4 rounded overflow-auto max-h-96 text-xs">
                      {JSON.stringify(stats, null, 2)}
                    </pre>
                  </details>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
