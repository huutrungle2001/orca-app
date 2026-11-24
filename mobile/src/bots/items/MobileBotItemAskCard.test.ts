import { expect, it, vi } from 'vitest'
import { makeTestBotItem } from '../../../../src/shared/bots/bot-item.test-fixture'
import type { BotItemEvent } from '../../../../src/shared/bots/bot-items'
import { botItemOpenAsk } from './MobileBotItemAskCard'

vi.mock('react-native', () => ({ Keyboard: { dismiss: () => {} } }))
vi.mock('../../i18n/use-mobile-translation', () => ({
  useMobileTranslation: () => ({ t: () => '' })
}))
vi.mock('../../session/native-chat/input/prompts/MobileNativeChatAsk', () => ({
  MobileNativeChatAsk: 'MobileNativeChatAsk'
}))

const AGENT = { kind: 'bot', botId: 'bot-a', chatId: 'chat-home' } as const
// Read while it asked; its ask is on an earlier page than the one loaded since.
const asking = makeTestBotItem(1, {
  status: 'needs_you',
  question: {
    eventId: 'e2',
    text: 'Merge PR #22?',
    decisions: [
      {
        question: 'Merge PR #22?',
        replies: [
          { label: 'Yes', recommended: false },
          { label: 'No', recommended: false }
        ]
      }
    ]
  },
  waitingAsk: 'e2',
  lastEventId: 'e10'
})

it('offers no answer card for the question the item named once a close read after it is loaded', () => {
  const closed: BotItemEvent = {
    id: 'e54',
    kind: 'status',
    actor: AGENT,
    data: { from: 'needs_you', to: 'done' },
    at: 0
  }
  expect(botItemOpenAsk(asking, [closed])).toBeNull()
})

it('keeps the answer card for that question when only later comments are loaded', () => {
  const comment: BotItemEvent = {
    id: 'e54',
    kind: 'commented',
    actor: AGENT,
    data: { text: 'CI is green now.' },
    at: 0
  }
  expect(botItemOpenAsk(asking, [comment])).toMatchObject({ askId: 'e2', open: [0] })
})
