import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { botItemAskText } from '../../../../src/shared/bots/bot-item-ask'
import { makeTestBotItem } from '../../../../src/shared/bots/bot-item.test-fixture'
import type { BotItem, BotItemEvent } from '../../../../src/shared/bots/bot-items'
import { createFakeRpcClient } from '../../mobile-web-shell/test-support/bridge-host-test-fakes'
import { usePhoneBotItemView, type PhoneBotItemView } from './use-phone-bot-item-view'

const reads = vi.hoisted(() => ({ readBotItem: vi.fn() }))
vi.mock('./bot-item-operations', () => ({ readBotItem: reads.readBotItem }))

const AGENT = { kind: 'bot', botId: 'bot-a', chatId: 'chat-home' } as const

function askEvent(id: string, prompt: string): BotItemEvent {
  const ask = { questions: [{ prompt, options: [{ label: 'Yes' }, { label: 'No' }] }] }
  return { id, kind: 'commented', actor: AGENT, data: { text: botItemAskText(ask), ask }, at: 0 }
}

let renderer: ReactTestRenderer | undefined
let view: PhoneBotItemView
// Never called: the item reads are mocked.
const client = createFakeRpcClient()
function Harness() {
  view = usePhoneBotItemView({ client, uid: 'uid-1', reads: 0 })
  return null
}

// The item as an earlier read of it named its ask, with the newest page and an earlier one behind it.
function open(item: BotItem, events: BotItemEvent[]) {
  reads.readBotItem.mockImplementation(
    async (_client?: unknown, _uid?: string, page?: { before?: string }) =>
      page?.before
        ? { kind: 'failed', notFound: false }
        : { kind: 'read', value: { item, events, earlierCursor: events[0]!.id } }
  )
  act(() => {
    renderer = create(createElement(Harness))
  })
}
const settle = async () => {
  for (let turn = 0; turn < 3; turn += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}
const pagedBack = () =>
  reads.readBotItem.mock.calls.filter(([, , page]) => page !== undefined && 'before' in page)

beforeEach(() => reads.readBotItem.mockReset())
afterEach(() => {
  act(() => renderer?.unmount())
  renderer = undefined
})

it('reads no earlier page for an ask the item named once the loaded page shows a later one waiting', async () => {
  // The item was read naming the earlier ask; the page, read after the agent asked again, holds
  // only the later one.
  const earlier = askEvent('e2', 'Merge PR #22?')
  const later = askEvent('e60', 'Merge PR #22 and #23?')
  open(
    makeTestBotItem(1, {
      status: 'needs_you',
      question: { eventId: earlier.id, text: String(earlier.data.text) },
      waitingAsk: earlier.id,
      lastEventId: 'e50'
    }),
    [later]
  )
  await settle()
  expect(view.events.map(({ id }) => id)).toEqual(['e60'])
  expect(pagedBack()).toEqual([])
  // So no failed read of a page it never needed takes the answer card and box away.
  expect(view.failed).toBe(false)
})

it('reads earlier pages for the waiting ask the loaded page does not hold yet', async () => {
  const later = askEvent('e60', 'Merge PR #22 and #23?')
  open(
    makeTestBotItem(1, {
      status: 'needs_you',
      question: { eventId: later.id, text: String(later.data.text) },
      waitingAsk: later.id,
      lastEventId: 'e70'
    }),
    [
      {
        id: 'e70',
        kind: 'commented',
        actor: AGENT,
        data: { text: 'CI is green now.' },
        at: 0
      }
    ]
  )
  await settle()
  expect(pagedBack().map(([, , page]) => page)).toEqual([{ newest: true, before: 'e70' }])
})
