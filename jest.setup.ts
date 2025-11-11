import '@testing-library/jest-dom'

// Mock next/navigation useRouter for client tests
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
    }
  },
}))

// Inform React that tests are running in a testing environment so act() warnings are handled
// See: https://react.dev/link/wrap-tests-with-act
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Provide a safe zodResolver for tests so zod validation errors return RHF-style errors
// instead of throwing raw ZodError which can destabilize Jest workers.
jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: (schema: unknown) => {
    return (data: unknown) => {
      // Try to safely call schema.safeParse if available
      const maybeSchema = schema as { safeParse?: (d: unknown) => unknown } | undefined
      const result = maybeSchema && typeof maybeSchema.safeParse === 'function' ? maybeSchema.safeParse(data) : ({ success: true, data } as unknown)

      // If result indicates failure and has an error.issues array, map to RHF errors
      if (result && typeof result === 'object') {
        const maybeSuccess = (result as { success?: unknown }).success
        if (maybeSuccess === false) {
          const resObj = result as { error?: { issues?: Array<Record<string, unknown>> } }
          const errors: Record<string, { message?: string; type?: string }> = {}
          if (resObj.error && Array.isArray(resObj.error.issues)) {
            for (const issue of resObj.error.issues) {
              const pathArr = Array.isArray(issue.path) ? issue.path : []
              const path = pathArr.join('.')
              errors[path] = { message: typeof issue.message === 'string' ? issue.message : undefined, type: typeof issue.code === 'string' ? issue.code : undefined }
            }
          }
          return { values: {}, errors }
        }
      }

      // Safe access to data if present
      const dataVal = result && typeof result === 'object' ? (result as { data?: unknown }).data : undefined
      return { values: dataVal ?? {}, errors: {} }
    }
  },
}))
