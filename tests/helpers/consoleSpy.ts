/**
 * Typed helper to spy on `console.error` for the duration of an async operation.
 * The spy implementation suppresses actual console output and is restored after the
 * operation completes. The assert function receives a typed spy instance so callers
 * can make strong assertions about calls.
 */
export type ConsoleErrorSpy = jest.SpyInstance<void, Parameters<typeof console.error>>

export async function withConsoleErrorSpy<T>(
  run: () => Promise<T>,
  assertFn: (spy: ConsoleErrorSpy) => void | Promise<void>
): Promise<T> {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {}) as ConsoleErrorSpy
  try {
    const result = await run()
    await assertFn(spy)
    return result
  } finally {
    spy.mockRestore()
  }
}

/**
 * Create and return a typed `console.error` spy that suppresses output.
 * Caller is responsible for restoring the spy.
 */
export function createConsoleErrorSpy(): ConsoleErrorSpy {
  return jest.spyOn(console, 'error').mockImplementation(() => {}) as ConsoleErrorSpy
}
