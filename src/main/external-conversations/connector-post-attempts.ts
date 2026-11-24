// When each chat, by its pane key, last tried to post into the thread it answers itself (`orca bot
// reply`, or a connector post or attach there), noted before the cloud call: an empty turn that
// tried is never retried, and its words before its last tool aren't its answer, whether the post
// landed or may have landed; one the cloud refused outright is taken back. Memory only: after a restart no live turn end retries anything.

// One entry per chat that posted; past this many, the longest idle goes first.
const MAX_CHATS = 1000

export class ConnectorPostAttempts {
  private readonly last = new Map<string, number>()

  constructor(private readonly now: () => number = Date.now) {}

  /** Notes an attempt; the returned call takes it back when the post was refused outright. */
  attempted(paneKey: string): () => void {
    const before = this.last.get(paneKey)
    const at = this.now()
    this.last.delete(paneKey)
    this.last.set(paneKey, at)
    if (this.last.size > MAX_CHATS) {
      this.last.delete(this.last.keys().next().value!)
    }
    return () => {
      if (this.last.get(paneKey) !== at) {
        return
      }
      if (before === undefined) {
        this.last.delete(paneKey)
      } else {
        this.last.set(paneKey, before)
      }
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
