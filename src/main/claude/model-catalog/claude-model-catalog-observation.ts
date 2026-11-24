import type { AgentSessionAccountKind } from '../../../shared/agent-session/failures/agent-session-availability'
import type { AgentModelCatalogSuccess } from '../../native-chat/agent-model-catalog/agent-model-catalog-entry'
import {
  isCompleteClaudeModelListing,
  listedModels,
  record
} from '../structured/launch/claude-structured-model-catalog'
import { claudeCatalogSignedOut } from './claude-model-catalog-signed-out'
import {
  claudeFastModeSupport,
  wireClaudeModels
} from '../structured/launch/claude-structured-catalog-listing'
import { readClaudeSettingsApplied } from '../structured/launch/claude-structured-session-options'

export function readClaudeCatalogObservation(
  replies: ReadonlyMap<string, unknown>,
  env: Readonly<Record<string, string>>,
  account: AgentSessionAccountKind
): AgentModelCatalogSuccess {
  const listing = replies.get('orca-model-discovery')
  const models = listedModels(listing)
  const settings = replies.get('orca-model-settings')
  const initialization = replies.get('orca-signin-discovery')
  const identity = record(record(initialization)?.account)
  const hasCredential = [identity?.tokenSource, identity?.apiKeySource].some(
    (source) => typeof source === 'string' && source.length > 0 && source !== 'none'
  )
  const applied = record(record(settings)?.applied)
  const configured =
    applied &&
    ['model', 'effort'].every((key) => applied[key] == null || typeof applied[key] === 'string')
      ? (readClaudeSettingsApplied(settings) ?? undefined)
      : undefined
  if (models.length === 0) {
    throw new Error('claude listed no models')
  }
  const fastModeSupport = claudeFastModeSupport(models)
  return {
    models: wireClaudeModels(models),
    origin: 'probe',
    complete: isCompleteClaudeModelListing(listing) && configured !== undefined,
    ...(hasCredential ? { signedIn: true } : {}),
    ...(fastModeSupport ? { fastModeSupport } : {}),
    ...(configured ? { configured } : {}),
    ...(claudeCatalogSignedOut(initialization, settings, env)
      ? { unavailable: { reason: 'notSignedIn', account } }
      : {})
  }
}
