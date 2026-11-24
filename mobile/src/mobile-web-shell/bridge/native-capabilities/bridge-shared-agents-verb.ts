import * as z from 'zod'
import { SHARED_BOT_HELD_STATES } from '../../../../../src/shared/bots/shared-bot-hosts'

// The agents shared with the page's computer's account, as this phone reaches them: one verb whose
// action reads their link and held messages, or sends a refused one again. The shell binds the host.
export const BRIDGE_SHARED_AGENTS_VERB = 'native.sharedAgents.act'

export const sharedAgentsParamsSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('read') }),
  z.strictObject({
    action: z.literal('sendAgain'),
    environmentId: z.string().min(1).max(128),
    clientMessageId: z.string().min(1).max(128)
  })
])

const heldSchema = z.object({
  clientMessageId: z.string(),
  sessionId: z.string(),
  text: z.string(),
  attachments: z.array(z.string()),
  sentAt: z.number(),
  state: z.enum(SHARED_BOT_HELD_STATES)
})

export const sharedAgentViewSchema = z.object({
  environmentId: z.string(),
  shareId: z.string(),
  botId: z.string(),
  botName: z.string(),
  ownerName: z.string(),
  homeWorkspaceId: z.string().nullable(),
  link: z.enum(['live', 'connecting', 'offline', 'unpaired']),
  holds: z.boolean(),
  held: z.array(heldSchema)
})

export const sharedAgentsResultSchema = z.union([
  z.strictObject({ hosts: z.array(sharedAgentViewSchema) }),
  z.strictObject({ sent: z.boolean() })
])

export type BridgeSharedAgentView = z.infer<typeof sharedAgentViewSchema>
