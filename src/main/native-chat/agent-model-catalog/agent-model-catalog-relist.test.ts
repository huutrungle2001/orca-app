import { expect, it, vi } from 'vitest'
import { harness, listing } from './agent-model-catalog-account-list-test-support'
import { AgentModelCatalogStore } from './agent-model-catalog-store'

it('attests a new account probe after relisting and never attests cached rows after a failed probe', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(1000)
  try {
    const store = new AgentModelCatalogStore({ now: () => Date.now() })
    const { read, runs, byFolder } = harness('codex', { store })
    const initial = await read('a', { waitForListing: true })
    expect(initial.origin).toBe('probe')
    const folder = runs[0]!
    delete byFolder[folder]
    const cached = await read('a', { waitForListing: true, relist: true })
    expect(cached.origin).toBe('probe')
    expect(cached.freshProbe).toBeUndefined()

    byFolder[folder] = listing(['fresh-model'])
    const fresh = read('a', { waitForListing: true, relist: true })
    vi.setSystemTime(2000)
    expect(await fresh).toMatchObject({ origin: 'probe', freshProbe: true })
  } finally {
    vi.useRealTimers()
  }
})
