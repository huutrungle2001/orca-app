// What the item's view leads to and how the comment box's words name it, from the pairing's read.
import {
  botItemReadAsksStand,
  type BotItemPairingItem,
  type BotItemWaitingLine
} from './bot-item-question-answers'
import type { BotItem, BotItemEvent } from './bot-items'

/** The ask the item's view leads to (Reply, and the earlier pages read to draw it): `waiting`, the ask
 *  its events show waiting (as `botItemWaitingAsk` found it, so no second pass), else the one the
 *  item's read names while that read still stands. */
export function botItemLeadAskId(
  item: BotItemPairingItem & Pick<BotItem, 'question'>,
  events: readonly BotItemEvent[],
  waiting: { askId: string } | null
): string | undefined {
  if (waiting) {
    return waiting.askId
  }
  return botItemReadAsksStand(item, events)
    ? (item.waitingAsk ?? item.question?.eventId)
    : undefined
}

/** How the comment box's words go out while no ask of several waits: naming the question its
 *  "Replying to" names; else plain, answering nothing, whenever the agent waits on one (its × closed,
 *  or an ask this view hasn't read yet), so the host never takes them as an answer no box showed. */
export function botItemBoxReply(
  item: Pick<BotItem, 'waitingAsk'>,
  oneLine: BotItemWaitingLine | null,
  replyingTo: string | null
): { questionId: string | undefined; plain: boolean } {
  const named = oneLine !== null && replyingTo === oneLine.id
  return {
    questionId: named ? oneLine.eventId : undefined,
    plain: !named && (oneLine !== null || item.waitingAsk !== undefined)
  }
}
