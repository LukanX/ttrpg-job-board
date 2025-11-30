'use client'

import { useState, useTransition } from 'react'
import { importCharacter } from '../actions'
import Link from 'next/link'

export default function ImportCharacterPage() {
  const [jsonInput, setJsonInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!jsonInput.trim()) {
      setError('Please paste the character JSON.')
      return
    }

    startTransition(async () => {
      const result = await importCharacter(jsonInput)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <Link href="/characters" className="text-blue-600 hover:text-blue-800">
            &larr; Back to Characters
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            Import Character
          </h1>
          <p className="text-gray-600 mt-2">
            Paste your character JSON export below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="json" className="block text-sm font-medium text-gray-700">
              Character JSON
            </label>
            <div className="mt-1">
              <textarea
                id="json"
                name="json"
                rows={15}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md font-mono"
                placeholder='{"success":true,"build":{...}}'
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isPending ? 'Importing...' : 'Import Character'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
