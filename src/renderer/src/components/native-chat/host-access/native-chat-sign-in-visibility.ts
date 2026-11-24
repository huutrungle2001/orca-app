export type NativeChatSignInSurface = 'banner' | 'transcript' | 'queue'
type Candidate = { surface: NativeChatSignInSurface; visible: boolean; full: boolean }

/** Keep the composer stable while a recovery action crosses the scroll edge. */
export function createNativeChatSignInVisibility() {
  const candidates = new Map<string, Candidate>()
  const listeners = new Set<() => void>()
  let snapshot: { selected: string | null; banner: boolean } = { selected: null, banner: true }
  let timer: ReturnType<typeof setTimeout> | undefined
  const publish = (selected: string | null, banner: boolean) => {
    if (snapshot.selected === selected && snapshot.banner === banner) {
      return
    }
    snapshot = { selected, banner }
    listeners.forEach((notify) => notify())
  }
  const update = () => {
    clearTimeout(timer)
    const ordered = [...candidates].sort(
      (a, b) => Number(b[1].surface === 'queue') - Number(a[1].surface === 'queue')
    )
    const chosen =
      ordered.find(([, value]) => value.full) ?? ordered.find(([, value]) => value.visible)
    if (chosen?.[1].full) {
      publish(chosen[0], false)
    } else if (chosen) {
      publish(chosen[0], snapshot.banner)
    } else {
      publish(ordered[0]?.[0] ?? null, snapshot.banner)
      timer = setTimeout(() => publish(ordered[0]?.[0] ?? null, true), 300)
    }
  }
  return {
    subscribe: (notify: () => void) => {
      listeners.add(notify)
      return () => {
        listeners.delete(notify)
      }
    },
    read: () => snapshot,
    observe: (key: string, surface: NativeChatSignInSurface, element: Element) => {
      candidates.set(key, { surface, visible: false, full: false })
      update()
      let root = element.parentElement
      while (root && !/(auto|scroll)/.test(getComputedStyle(root).overflowY)) {
        root = root.parentElement
      }
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!candidates.has(key)) {
            return
          }
          candidates.set(key, {
            surface,
            visible: entry.isIntersecting,
            full: entry.isIntersecting && entry.intersectionRatio >= 1
          })
          update()
        },
        { root, threshold: [0, 1] }
      )
      observer.observe(element)
      return () => {
        observer.disconnect()
        candidates.delete(key)
        update()
      }
    },
    dispose: () => {
      clearTimeout(timer)
      listeners.clear()
      candidates.clear()
    }
  }
}
