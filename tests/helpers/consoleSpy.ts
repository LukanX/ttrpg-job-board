// Helper to spy on console.error for the duration of an async operation.
// It suppresses output and ensures the spy is restored afterwards.
export async function withConsoleErrorSpy<T = any>(
  run: () => Promise<T>,
  assertFn: (spy: jest.SpyInstance) => void | Promise<void>
): Promise<T> {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const result = await run()
    await assertFn(spy)
    return result
  } finally {
    spy.mockRestore()
  }
}

export function createConsoleErrorSpy() {
  return jest.spyOn(console, 'error').mockImplementation(() => {})
}
