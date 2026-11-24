// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useNativeChatHostSetup } from './native-chat-host-setup'
import { NativeChatHostSetupContext } from './native-chat-host-setup-view'
import { NativeChatTranscriptSignInNotice } from './NativeChatSignInRow'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { AppState } from '@/store/types'
const { refresh, fetchSettings, modelCatalog } = vi.hoisted(() => ({
  refresh: vi.fn(),
  fetchSettings: vi.fn(async () => {}),
  modelCatalog: vi.fn(async () => ({ origin: 'probe', models: [] }))
}))
vi.mock('@/store/index', () => ({
  useAppStore: Object.assign(
    (select: (state: unknown) => unknown) =>
      select({ settings: {}, runtimeStatusByEnvironmentId: new Map(), agentCliUpdates: new Map() }),
    { getState: () => ({ fetchSettings }) }
  )
}))
vi.mock('./native-chat-host-command-terminal', () => ({
  useNativeChatHostCommandTerminal: () => null
}))
vi.mock('@/store/slices/runtime-status/views/use-runtime-status-view', () => ({
  useAppStoreWithHostStatuses: (
    select: (state: Pick<AppState, 'settings'>, statuses: Map<string, never>) => unknown
  ) => select({ settings: null }, new Map<string, never>())
}))
vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  callStructuredAgentSession: modelCatalog
}))
const target = { kind: 'local' as const }
function Recovery({ failureKey }: { failureKey: string }) {
  const setup = useNativeChatHostSetup({
    agent: 'codex',
    sessionId: 'chat',
    worktreeId: 'folder',
    account: 'managed',
    needsSignIn: true,
    target,
    failureKey,
    failure: null,
    startFailures: [],
    journalItems: [],
    onRechecked: refresh,
    onSignInRechecked: refresh
  })
  return (
    <TooltipProvider>
      <NativeChatHostSetupContext.Provider value={setup}>
        <NativeChatTranscriptSignInNotice
          agentName="Codex"
          account="managed"
          fallback={() => null}
        />
        <span role="status">{setup.announcement}</span>
      </NativeChatHostSetupContext.Provider>
    </TooltipProvider>
  )
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('signs in the chat account once, rechecks without sending and offers recovery for a new failure', async () => {
  let complete!: () => void
  const login = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve
      })
  )
  const send = vi.fn()
  Object.assign(window, {
    api: {
      codexAccounts: { chatSignInAccount: async () => 'chat-account', reauthenticate: login },
      pty: { onExit: () => () => {} },
      agentSessions: { send }
    }
  })
  const { rerender } = render(<Recovery failureKey="original" />)
  const button = await screen.findByRole('button', { name: 'Sign in' })
  act(() => {
    fireEvent.click(button)
    fireEvent.click(button)
  })
  expect(login).toHaveBeenCalledOnce()
  expect(login).toHaveBeenCalledWith({ accountId: 'chat-account', sessionId: 'chat' })
  expect(screen.getByRole('button', { name: 'Signing in…' })).toHaveProperty('disabled', true)
  expect(modelCatalog).not.toHaveBeenCalled()
  await act(async () => {
    complete()
  })
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  expect(refresh).toHaveBeenCalledOnce()
  expect(send).not.toHaveBeenCalled()
  rerender(<Recovery failureKey="new-failure" />)
  expect(await screen.findByRole('button', { name: 'Sign in' })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('')
})
