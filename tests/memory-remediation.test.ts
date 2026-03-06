import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeRemainingRelatedCountByNode,
  deleteRelatedCacheEntries,
  setRelatedCacheEntry,
  touchRelatedCacheEntry,
} from '../src/features/graph/hooks/relatedCache'
import type { DiscoverEntity, GraphEdge, GraphNode } from '../src/types'

function createEntity(kind: DiscoverEntity['kind'], tmdbId: number): DiscoverEntity {
  return {
    kind,
    tmdbId,
    title: `${kind}-${tmdbId}`,
    imagePath: null,
  }
}

function createNode(
  key: string,
  kind: GraphNode['kind'],
  tmdbId: number,
  expansionCursor = 0,
): GraphNode {
  return {
    key,
    kind,
    tmdbId,
    title: key,
    imagePath: null,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    expansionCursor,
    totalRelated: 0,
    loading: false,
  }
}

describe('related cache memory helpers', () => {
  it('evicts oldest entries and respects LRU touch', () => {
    const cache = new Map<string, DiscoverEntity[]>()

    setRelatedCacheEntry(cache, 'a', [createEntity('person', 1)], 2)
    setRelatedCacheEntry(cache, 'b', [createEntity('movie', 2)], 2)
    setRelatedCacheEntry(cache, 'c', [createEntity('tv', 3)], 2)

    expect(cache.has('a')).toBe(false)
    expect(Array.from(cache.keys())).toEqual(['b', 'c'])

    const touched = touchRelatedCacheEntry(cache, 'b')
    expect(touched?.[0]?.tmdbId).toBe(2)
    expect(Array.from(cache.keys())).toEqual(['c', 'b'])

    setRelatedCacheEntry(cache, 'd', [createEntity('person', 4)], 2)
    expect(cache.has('c')).toBe(false)
    expect(Array.from(cache.keys())).toEqual(['b', 'd'])
  })

  it('deletes selected cache keys', () => {
    const cache = new Map<string, DiscoverEntity[]>()
    setRelatedCacheEntry(cache, 'left', [createEntity('person', 1)], 5)
    setRelatedCacheEntry(cache, 'middle', [createEntity('movie', 2)], 5)
    setRelatedCacheEntry(cache, 'right', [createEntity('tv', 3)], 5)

    deleteRelatedCacheEntries(cache, ['left', 'right'])

    expect(cache.has('left')).toBe(false)
    expect(cache.has('middle')).toBe(true)
    expect(cache.has('right')).toBe(false)
  })

  it('precomputes remaining related counts without double counting', () => {
    const personKey = 'person:1'
    const movieConnectedKey = 'movie:10'
    const movieQueuedKey = 'movie:11'
    const movieSkippedKey = 'movie:12'

    const nodes: Record<string, GraphNode> = {
      [personKey]: createNode(personKey, 'person', 1, 0),
      [movieConnectedKey]: createNode(movieConnectedKey, 'movie', 10),
    }

    const edges: Record<string, GraphEdge> = {
      [`${movieConnectedKey}|${personKey}`]: {
        key: `${movieConnectedKey}|${personKey}`,
        source: movieConnectedKey,
        target: personKey,
      },
    }

    const relatedCache = new Map<string, DiscoverEntity[]>()
    relatedCache.set(personKey, [
      createEntity('movie', 10),
      createEntity('movie', 11),
      createEntity('movie', 12),
    ])

    const replayQueueByNodeKey = {
      [personKey]: [movieQueuedKey, movieQueuedKey, movieSkippedKey],
    }

    const remainingByNode = computeRemainingRelatedCountByNode({
      nodes,
      edges,
      relatedCache,
      replayQueueByNodeKey,
      shouldSkipRelatedEntity: (parent, candidate) => {
        return parent.key === personKey && candidate.tmdbId === 12
      },
    })

    expect(remainingByNode[personKey]).toBe(1)
    expect(remainingByNode[movieConnectedKey] ?? 0).toBe(0)
  })
})

describe('tmdb abort handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.resetModules()
    delete (globalThis as { __TMDB_API_KEY__?: string }).__TMDB_API_KEY__
  })

  it('propagates AbortSignal through searchMulti', async () => {
    ;(globalThis as { __TMDB_API_KEY__?: string }).__TMDB_API_KEY__ = 'test-key'

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => {
            const error = new Error('aborted')
            error.name = 'AbortError'
            reject(error)
          },
          { once: true },
        )
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const tmdb = await import('../src/tmdb')
    const controller = new AbortController()
    const request = tmdb.searchMulti('matrix', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(tmdb.isAbortError(await request.catch((error) => error))).toBe(true)
  })
})
