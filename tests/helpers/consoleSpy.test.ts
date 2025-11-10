import { withConsoleErrorSpy, createConsoleErrorSpy } from '@/tests/helpers/consoleSpy'

describe('consoleSpy helper', () => {
  afterEach(() => {
    jest.resetAllMocks()
  })

  test('withConsoleErrorSpy suppresses output and records console.error calls', async () => {
    await withConsoleErrorSpy(
      async () => {
        // This call should be captured by the helper's spy and not print to stdout
        console.error('Test error', { message: 'boom' })
        return 'done'
      },
      (spy) => {
        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith('Test error', { message: 'boom' })
      }
    )
  })

  test('createConsoleErrorSpy returns a spy that can be asserted and restored', () => {
    const spy = createConsoleErrorSpy()
    try {
      console.error('another error')
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('another error')
    } finally {
      spy.mockRestore()
    }
  })
})
