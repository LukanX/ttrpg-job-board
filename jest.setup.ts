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
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

// Provide a safe zodResolver for tests so zod validation errors return RHF-style errors
// instead of throwing raw ZodError which can destabilize Jest workers.
jest.mock('@hookform/resolvers/zod', () => ({
  zodResolver: (schema: any) => {
    return (data: any) => {
      const result = schema && typeof schema.safeParse === 'function' ? schema.safeParse(data) : { success: true, data }
      if (!result.success) {
        const errors: any = {}
        for (const issue of result.error.issues) {
          const path = issue.path.join('.')
          errors[path] = { message: issue.message, type: issue.code }
        }
        return { values: {}, errors }
      }
      return { values: result.data, errors: {} }
    }
  },
}))
