// When each chat, by its pane key, tried to post into the thread it answers itself (`orca bot
// reply`, or a connector post or attach there), noted before the cloud call: an empty turn that
// tried is never retried, and its words before its last tool aren't its answer, whether the post
// landed or may have landed. One the cloud refused outright is taken back. Memory only: after a
// restart no live turn end retries anything.

// Chats kept; past this many, the longest idle goes first. Each keeps its newest attempts only.
const MAX_CHATS = 1000
const MAX_ATTEMPTS = 32

export class ConnectorPostAttempts {
  private readonly attempts = new Map<string, Set<{ at: number }>>()

  constructor(private readonly now: () => number = Date.now) {}

  /** Notes an attempt; the returned call takes back that one attempt when it was refused outright. */
  attempted(paneKey: string): () => void {
    const attempt = { at: this.now() }
    const chat = this.attempts.get(paneKey) ?? new Set()
    this.attempts.delete(paneKey)
    this.attempts.set(paneKey, chat.add(attempt))
    if (chat.size > MAX_ATTEMPTS) {
      chat.delete(chat.values().next().value!)
    }
    if (this.attempts.size > MAX_CHATS) {
      this.attempts.delete(this.attempts.keys().next().value!)
    }
    return () => {
      chat.delete(attempt)
    }
  }

  /** Whether the chat tried a post, not taken back, from `at` to `until` (its turn's start and end). */
  since(paneKey: string, at: number, until = Number.POSITIVE_INFINITY): boolean {
    for (const attempt of this.attempts.get(paneKey) ?? []) {
      if (attempt.at >= at && attempt.at <= until) {
        return true
      }
    }
    return false
  }
}

/** The running app's record: the post paths note into it, the reply fill reads it. */
export const connectorPostAttempts = new ConnectorPostAttempts()
