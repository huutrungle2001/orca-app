import { expect, it } from 'vitest'
import { ConnectorPostAttempts } from './connector-post-attempts'

// A refused post never stands as the chat's own answer, and taking it back never erases a later one.
it('takes back only a refused attempt, leaving earlier and later ones', () => {
  let now = 10
  const attempts = new ConnectorPostAttempts(() => now)
  attempts.attempted('chat')
  now = 20
  const refused = attempts.attempted('chat')
  refused()
  expect([attempts.since('chat', 10), attempts.since('chat', 15)]).toEqual([true, false])
  now = 30
  const late = attempts.attempted('chat')
  now = 40
  attempts.attempted('chat')
  late()
  expect(attempts.since('chat', 35)).toBe(true)
})
