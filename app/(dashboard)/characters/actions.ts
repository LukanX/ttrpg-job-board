'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function importCharacter(jsonString: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const data = JSON.parse(jsonString)
    
    // Basic validation based on the sample provided
    if (!data.build || !data.build.name) {
      return { error: 'Invalid character JSON format. Missing "build" or "name".' }
    }

    const character = {
      user_id: user.id,
      name: data.build.name,
      class: data.build.class || 'Unknown',
      ancestry: data.build.ancestry || 'Unknown',
      level: data.build.level || 1,
      stats: data
    }

    const { error } = await supabase
      .from('characters')
      .insert(character)

    if (error) {
      console.error('Database error:', error)
      return { error: 'Failed to save character to database.' }
    }

  } catch (e) {
    console.error('Parse error:', e)
    return { error: 'Invalid JSON string.' }
  }

  revalidatePath('/characters')
  redirect('/characters')
}
