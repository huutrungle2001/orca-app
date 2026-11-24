// When each chat, by its pane key, last tried to post into the thread it answers itself (`orca bot
// reply`, or a connector post or attach there), noted before the cloud call: an empty turn that
// tried is never retried, and its words before its last tool aren't its answer, whether the post
// landed, failed or may have landed. Memory only: after a restart no live turn end retries anything.

// One entry per chat that posted; past this many, the longest idle goes first.
const MAX_CHATS = 1000

export class ConnectorPostAttempts {
  private readonly last = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  attempted(paneKey: string): void {
    this.last.delete(paneKey)
    this.last.set(paneKey, this.now())
    if (this.last.size > MAX_CHATS) {
      this.last.delete(this.last.keys().next().value!)
    }
  }

  /** Whether the chat tried a post at or after `at` (its ended turn's start). */
  since(paneKey: string, at: number): boolean {
    const last = this.last.get(paneKey)
    return last !== undefined && last >= at
  }
}

/** The running app's record: the post paths note into it, the reply fill reads it. */
export const connectorPostAttempts = new ConnectorPostAttempts()
