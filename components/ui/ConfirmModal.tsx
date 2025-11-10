"use client"

import React, { useEffect, useRef } from 'react'

type Props = {
  isOpen: boolean
  title?: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  confirmTestId?: string
  cancelTestId?: string
}

export default function ConfirmModal({
  isOpen,
  title = 'Confirm',
  message,
  onConfirm,
  onCancel,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTestId,
  cancelTestId,
}: Props) {
  const modalRef = useRef<HTMLDivElement | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Save previous focus and prevent background scroll
    previouslyFocused.current = document.activeElement as HTMLElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const node = modalRef.current
    const focusableSelector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

    const focusFirst = () => {
      const focusable = node?.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusable && focusable.length) {
        focusable[0].focus()
      }
    }

    // small delay to ensure element is in DOM
    const t = window.setTimeout(focusFirst, 0)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.key === 'Tab') {
        // basic focus trap
        const focusable = node?.querySelectorAll<HTMLElement>(focusableSelector)
        if (!focusable || focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', onKey)

    return () => {
      window.clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // restore previous focus
      try {
        previouslyFocused.current?.focus()
      } catch {}
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <div className="absolute inset-0 bg-black opacity-40" onClick={onCancel} />

      <div ref={modalRef} className="bg-white rounded-lg shadow-lg z-10 max-w-md w-full p-6">
        <h3 id="confirm-modal-title" className="text-lg font-semibold mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-700 mb-4">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            data-testid={cancelTestId}
            className="px-3 py-1 border rounded"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid={confirmTestId}
            className="px-3 py-1 bg-red-600 text-white rounded"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
