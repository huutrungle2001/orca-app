import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/store/index'
import { useAppStoreWithHostStatuses } from '@/store/slices/runtime-status/views/use-runtime-status-view'
import { translate } from '@/i18n/i18n'
import { signInToClaudeAccount } from '@/lib/provider-accounts/claude-account-sign-in'
import { getRendererAppPlatform } from '@/app-shell/platform/renderer-app-platform'
import { callStructuredAgentSession } from '@/runtime/native-chat/requests/structured-agent-session-call'
import type { AgentSessionModelCatalogResult } from '../../../../../shared/agent-session/agent-session-wire'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import type { AgentSessionAccountKind } from '../../../../../shared/agent-session/failures/agent-session-availability'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import {
  agentSessionSignInCommand,
  agentSessionSignInEnv
} from '../../../../../shared/agent-session/lifecycle/launch/agent-session-setup-commands'
import { lastVerifiedRuntimeStatus } from '../../../../../shared/remote-runtime/host-status/runtime-host-status'
import { resolveHostAgentStartupShell } from '../../../../../shared/shell/launch/windows-terminal-shell'
import type { NativeChatHostCommandTerminal } from './native-chat-host-command-terminal'
import {
  useNativeChatTerminalSignInRecheck,
  type NativeChatTerminalSignIn
} from './use-native-chat-terminal-sign-in-recheck'
export type NativeChatHostSetupInput = {
  agent: string
  target: RuntimeClientTarget
  worktreeId: string | null
  groupId?: string
  sessionId?: string
  isVisible?: boolean
  failureKey?: string
  transcriptFailureId?: string
  needsSignIn?: boolean
  account: AgentSessionAccountKind | undefined
  failure: unknown
  startFailures: readonly { kind: string }[]
  journalItems: readonly AgentJournalRenderItem[]
  onRechecked: () => void
  onSignInRechecked?: () => void
}

export function useNativeChatSignIn(
  input: NativeChatHostSetupInput,
  terminal: NativeChatHostCommandTerminal | null
) {
  const {
    agent,
    sessionId,
    account,
    failureKey = '',
    needsSignIn,
    target,
    onSignInRechecked
  } = input
  const local = input.target.kind === 'local'
  const claudeAccountId = useAppStore((s) =>
    agent === 'claude' && local && account !== 'system'
      ? (s.settings?.activeClaudeManagedAccountIdsByRuntime?.host ??
        s.settings?.activeClaudeManagedAccountId ??
        null)
      : null
  )
  const codexIdentity = local && agent === 'codex' && account !== 'system' ? sessionId : undefined
  const codexSelection = useAppStore((s) =>
    codexIdentity && needsSignIn
      ? (s.settings?.activeCodexManagedAccountIdsByRuntime?.host ??
        s.settings?.activeCodexManagedAccountId ??
        null)
      : null
  )
  const [codexAccount, setCodexAccount] = useState<{
    sessionId: string
    failureKey: string
    selection: string | null
    id: string | null
  } | null>(null)
  if (!needsSignIn && codexAccount?.id === null) {
    setCodexAccount(null)
  }
  useEffect(() => {
    if (!codexIdentity || !needsSignIn) {
      return
    }
    let current = true
    void window.api.codexAccounts
      .chatSignInAccount({ sessionId: codexIdentity })
      .catch(() => undefined)
      .then((id) => {
        if (current && id !== undefined) {
          setCodexAccount({ sessionId: codexIdentity, failureKey, selection: codexSelection, id })
        }
      })
    return () => {
      current = false
    }
  }, [codexIdentity, failureKey, codexSelection, needsSignIn])
  const chatAccount = codexAccount?.sessionId === codexIdentity ? codexAccount : null
  const codexAccountId = chatAccount?.id
  const codexLookupComplete =
    chatAccount?.failureKey === failureKey && chatAccount.selection === codexSelection
  const shell = useAppStoreWithHostStatuses((s, statuses) => {
    const status =
      input.target.kind === 'environment'
        ? lastVerifiedRuntimeStatus(statuses.get(input.target.environmentId))
        : null
    const platform = local ? getRendererAppPlatform() : status?.hostPlatform
    if (!platform) {
      return null
    }
    return (
      resolveHostAgentStartupShell({
        platform,
        isRemote: !local,
        hostTerminalWindowsShell: local
          ? s.settings?.terminalWindowsShell
          : status?.terminalWindowsShell
      }) ?? (platform === 'win32' ? null : 'posix')
    )
  })
  const command = agentSessionSignInCommand(agent, { account, remote: !local, shell })
  const terminalAllowed =
    !(agent === 'codex' && account === 'managed') &&
    !(codexIdentity && needsSignIn && !codexLookupComplete)
  const identity = `${agent}:${local ? 'local' : input.target.kind === 'environment' ? input.target.environmentId : ''}:${sessionId ?? ''}:${codexAccountId ?? claudeAccountId ?? account ?? ''}`
  const [state, setState] = useState<{
    identity: string
    failureKey: string
    busy: boolean
    resolvedFor: string | null
    announcement: string
  }>({
    identity,
    failureKey,
    busy: false,
    resolvedFor: null,
    announcement: ''
  })
  if (state.identity !== identity || (!state.busy && state.failureKey !== failureKey)) {
    setState({ identity, failureKey, busy: false, resolvedFor: null, announcement: '' })
  }
  const inFlight = useRef(false)
  const [terminalSignIn, setTerminalSignIn] = useState<NativeChatTerminalSignIn | null>(null)
  const attempt = useRef(0)
  useEffect(
    () => () => {
      ++attempt.current
      inFlight.current = false
    },
    [identity]
  )
  const resolved = state.identity === identity && state.resolvedFor === failureKey
  const busy = state.identity === identity && state.busy
  const recheck = useCallback(async () => {
    if (!sessionId) {
      return false
    }
    const result = await callStructuredAgentSession<AgentSessionModelCatalogResult>(
      target,
      'agentSession.modelCatalog',
      { agent, sessionId, waitForListing: true }
    ).catch(() => null)
    return Boolean(
      result && result.origin !== 'unknown' && !result.listingInProgress && !result.unavailable
    )
  }, [agent, sessionId, target])
  const finish = useCallback(
    async (ticket: number) => {
      if (ticket !== attempt.current) {
        return false
      }
      const signedIn = await recheck()
      if (ticket !== attempt.current) {
        return false
      }
      inFlight.current = false
      setState({
        identity,
        failureKey,
        busy: false,
        resolvedFor: signedIn ? failureKey : null,
        announcement: signedIn
          ? translate('components.native-chat.signIn.succeeded', 'Signed in.')
          : translate(
              'components.native-chat.signIn.notConfirmed',
              'Sign-in could not be confirmed. Try again.'
            )
      })
      onSignInRechecked?.()
      return signedIn
    },
    [recheck, identity, failureKey, onSignInRechecked]
  )
  if (terminalSignIn && terminalSignIn.identity !== identity) {
    setTerminalSignIn(null)
  }
  useNativeChatTerminalSignInRecheck(terminalSignIn, input.isVisible, finish, (ticket) => {
    setTerminalSignIn((signIn) => (signIn?.ticket === ticket ? null : signIn))
  })
  const { worktreeId } = input
  const signIn = useCallback(() => {
    if (inFlight.current) {
      return
    }
    inFlight.current = true
    setTerminalSignIn(null)
    const ticket = ++attempt.current
    setState({ identity, failureKey, busy: true, resolvedFor: null, announcement: '' })
    void (async () => {
      if (codexAccountId && sessionId) {
        await window.api.codexAccounts.reauthenticate({ accountId: codexAccountId, sessionId })
        await useAppStore.getState().fetchSettings()
      } else if (claudeAccountId) {
        if (!(await signInToClaudeAccount(claudeAccountId))) {
          throw new Error('Sign-in cancelled or failed')
        }
      } else if (command && terminal && terminalAllowed) {
        const opened = await terminal.open(command, agentSessionSignInEnv(agent))
        if (!opened) {
          throw new Error('Sign-in terminal did not open')
        }
        if (ticket === attempt.current) {
          setTerminalSignIn({ identity, ticket, worktreeId, tabId: opened.tabId })
          inFlight.current = false
          setState((current) => ({ ...current, busy: false }))
        }
        return
      } else {
        throw new Error('Sign-in unavailable')
      }
      await finish(ticket)
    })().catch(() => {
      if (ticket !== attempt.current) {
        return
      }
      inFlight.current = false
      setState({
        identity,
        failureKey,
        busy: false,
        resolvedFor: null,
        announcement: translate(
          'components.native-chat.signIn.cancelled',
          'Sign-in cancelled or failed. Try again.'
        )
      })
    })
  }, [
    identity,
    failureKey,
    codexAccountId,
    claudeAccountId,
    sessionId,
    agent,
    command,
    terminal,
    terminalAllowed,
    worktreeId,
    finish
  ])
  const available = Boolean(
    codexAccountId || claudeAccountId || (command && terminal && terminalAllowed)
  )
  const signInView = useMemo(
    () =>
      available
        ? {
            signingIn: busy,
            signedIn: resolved,
            signIn,
            ...(command && !codexAccountId && !claudeAccountId ? { loginCommand: command } : {})
          }
        : null,
    [available, resolved, busy, signIn, command, codexAccountId, claudeAccountId]
  )
  const announcement =
    state.identity === identity && state.failureKey === failureKey ? state.announcement : ''
  return useMemo(
    () => ({ signIn: signInView, resolved, announcement }),
    [signInView, resolved, announcement]
  )
}
