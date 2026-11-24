// What a teammate's share connection may call: one bot's chats and nothing else on the host. Every
// method names how the share guard admits it, so a method can't be allowed without its check.
import { z } from 'zod'
import { BOT_SHARE_PROVISION_PHONE_METHOD, BOT_SHARE_REVOKE_PHONE_METHOD } from './bot-share-phone'

/** `chat`: the session it names must be one of the teammate's own chats on the shared bot.
 *  `bot`: the bot it names must be the shared bot; its handler lists only the teammate's chats.
 *  `scoped`: names nothing; its handler returns only the shared bot and the teammate's chats.
 *  `self`: bound to the caller's own connection (its Relay credential, its uploads, its phone). */
export type BotShareMethodAccess =
  | { kind: 'chat'; sessionId: (params: unknown) => string | undefined }
  | { kind: 'bot'; botId: (params: unknown) => string | undefined }
  | { kind: 'scoped' }
  | { kind: 'self' }

const SessionParams = z.looseObject({ sessionId: z.string() })
const EnvelopeParams = z.looseObject({ envelope: SessionParams })
const BotParams = z.looseObject({ botId: z.string() })

const SESSION: BotShareMethodAccess = {
  kind: 'chat',
  sessionId: (params) => SessionParams.safeParse(params).data?.sessionId
}
const ENVELOPE_SESSION: BotShareMethodAccess = {
  kind: 'chat',
  sessionId: (params) => EnvelopeParams.safeParse(params).data?.envelope.sessionId
}
const BOT: BotShareMethodAccess = {
  kind: 'bot',
  botId: (params) => BotParams.safeParse(params).data?.botId
}
const SCOPED: BotShareMethodAccess = { kind: 'scoped' }
const SELF: BotShareMethodAccess = { kind: 'self' }

export const BOT_SHARE_RPC_METHODS: ReadonlyMap<string, BotShareMethodAccess> = new Map<
  string,
  BotShareMethodAccess
>([
  ['bots.list', SCOPED],
  ['bots.roster', SCOPED],
  ['bots.chats.own', SCOPED],
  ['agentSession.subscribeStatus', SCOPED],
  ['bots.avatar.read', BOT],
  ['bots.chats', BOT],
  ['bots.chatTree', BOT],
  ['bots.session.start', BOT],
  ['agentSession.history', SESSION],
  ['agentSession.subscribe', SESSION],
  ['agentSession.unsubscribe', SESSION],
  ['agentSession.item', SESSION],
  ['agentSession.currentRequests', SESSION],
  ['agentSession.readVisual', SESSION],
  ['agentSession.queuedMessageEditHold', SESSION],
  ['agentSession.send', ENVELOPE_SESSION],
  ['agentSession.respondToApproval', ENVELOPE_SESSION],
  ['agentSession.respondToQuestion', ENVELOPE_SESSION],
  ['agentSession.cancel', ENVELOPE_SESSION],
  ['agentSession.queuedMessageSend', ENVELOPE_SESSION],
  ['agentSession.queuedMessageDelete', ENVELOPE_SESSION],
  ['agentSession.queuedMessageMove', ENVELOPE_SESSION],
  ['agentSession.queuedMessageUpdate', ENVELOPE_SESSION],
  ['agentSession.queuedMessagesResume', ENVELOPE_SESSION],
  // An upload names the chat it is for; the rest go by upload id, under the share socket's own caller key.
  ['agentSessionAttachment.uploadStart', SESSION],
  ['agentSessionAttachment.uploadAppend', SELF],
  ['agentSessionAttachment.uploadCommit', SELF],
  ['agentSessionAttachment.uploadAbort', SELF],
  // Both bind to the socket's own device row.
  ['pairing.getEndpoints', SELF],
  ['pairing.provisionRelay', SELF],
  // A teammate's computer asks for and ends its own phone's key; refused to a phone's key.
  [BOT_SHARE_PROVISION_PHONE_METHOD, SELF],
  [BOT_SHARE_REVOKE_PHONE_METHOD, SELF]
])
