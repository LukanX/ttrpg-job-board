import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import type { Character } from '@/types/database'

export default async function CharactersPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: characters, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching characters:', error)
  }

  return (
    <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            My Characters
          </h1>
          <Link
            href="/characters/import"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Import Character
          </Link>
        </div>

        {characters && characters.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((character: Character) => (
              <div
                key={character.id}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <Link href={`/characters/${character.id}`} className="inline-block">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {character.name}
                      </h3>
                    </Link>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Level {character.level} {character.ancestry} {character.class}</p>
                    <p className="text-xs text-gray-500">
                      Imported: {new Date(character.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">You haven't imported any characters yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
