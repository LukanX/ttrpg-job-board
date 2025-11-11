'use client'

import React, { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { nanoid } from 'nanoid'
import type { Campaign } from '@/types/database'

const CampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  party_level: z.number().int().min(1).max(20),
})

type CampaignFormValues = z.infer<typeof CampaignSchema>

export default function CampaignForm({
  campaign,
  onSuccess,
}: {
  campaign?: { id: string; name: string; party_level: number }
  onSuccess?: (updated?: Partial<Campaign>) => void
}) {
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CampaignFormValues>({
    resolver: zodResolver(CampaignSchema),
    defaultValues: { name: campaign?.name ?? '', party_level: campaign?.party_level ?? 1 },
  })

  useEffect(() => {
    if (campaign) {
      setValue('name', campaign.name)
      setValue('party_level', campaign.party_level)
    }
  }, [campaign, setValue])

  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const onSubmit = async (values: CampaignFormValues) => {
    setServerError(null)
    setLoading(true)

    try {
      if (campaign && campaign.id) {
        if (!campaign.id) {
          throw new Error('Campaign id missing')
        }
        // Edit flow: call PATCH API route
        const res = await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        })

        if (!res.ok) {
          const json = await res.json().catch(() => ({ error: 'Unknown error' }))
          throw new Error(json?.error?.message || json?.error || 'Failed to update campaign')
        }

        const json = await res.json()
        if (onSuccess) onSuccess(json.campaign)
        router.push(`/gm/campaigns/${campaign.id}`)
        router.refresh()
      } else {
        // Create flow: client-side supabase insert
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) throw new Error('Not authenticated')

        const shareCode = nanoid(10)

        const { data, error } = await supabase
          .from('campaigns')
          .insert({
            gm_id: user.id,
            name: values.name,
            party_level: values.party_level,
            share_code: shareCode,
          })
          .select()
          .single()

  if (error) throw error

  if (onSuccess) onSuccess(data)
        router.push(`/gm/campaigns/${data.id}`)
        router.refresh()
      }
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Server error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{serverError}</div>
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Campaign Name
        </label>
        <input
          id="name"
          {...register('name')}
          defaultValue={campaign?.name ?? ''}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          placeholder="e.g., Starfinder Society Adventures"
        />
        {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="party_level" className="block text-sm font-medium text-gray-700">
          Party Level
        </label>
        <input
          id="party_level"
          type="number"
          {...register('party_level', { valueAsNumber: true })}
          defaultValue={campaign?.party_level ?? 1}
          min={1}
          max={20}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
        />
        {errors.party_level && (
          <p className="text-sm text-red-600 mt-1">{errors.party_level.message}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">Current level of your party (1-20)</p>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (campaign ? 'Saving...' : 'Creating...') : campaign ? 'Save Changes' : 'Create Campaign'}
        </button>
      </div>
    </form>
  )
}
