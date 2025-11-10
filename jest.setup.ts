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
