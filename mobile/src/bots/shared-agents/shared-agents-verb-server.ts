// The shell's answer to a page's shared-agents verb, for the computer the page belongs to.
import { sharedAgentsParamsSchema } from '../../mobile-web-shell/bridge/native-capabilities/bridge-shared-agents-verb'
import type { PhoneSharedAgents } from './phone-shared-agents'

export async function serveSharedAgentsVerb(
  agents: Pick<PhoneSharedAgents, 'ready' | 'views' | 'find' | 'sendAgain' | 'refreshHeld'>,
  pairedHostId: string,
  raw: unknown
): Promise<unknown> {
  const params = sharedAgentsParamsSchema.parse(raw)
  await agents.ready()
  if (params.action === 'read') {
    // A page reading states is the moment to ask Orca Cloud how the waiting ones stand.
    void agents.refreshHeld(pairedHostId)
    return { hosts: agents.views(pairedHostId) }
  }
  const agent = agents.find(pairedHostId, params.environmentId)
  return { sent: agent ? await agents.sendAgain(agent, params.clientMessageId) : false }
}
