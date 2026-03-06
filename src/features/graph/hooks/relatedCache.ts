import { entityKey, type DiscoverEntity, type GraphEdge, type GraphNode } from '../../../types'

export const RELATED_CACHE_LIMIT = 200

export function touchRelatedCacheEntry(cache: Map<string, DiscoverEntity[]>, key: string): DiscoverEntity[] | null {
  const cached = cache.get(key)

  if (!cached) {
    return null
  }

  cache.delete(key)
  cache.set(key, cached)
  return cached
}

export function setRelatedCacheEntry(
  cache: Map<string, DiscoverEntity[]>,
  key: string,
  related: DiscoverEntity[],
  limit = RELATED_CACHE_LIMIT,
): void {
  if (cache.has(key)) {
    cache.delete(key)
  }

  cache.set(key, related)

  while (cache.size > limit) {
    const oldest = cache.keys().next().value

    if (!oldest) {
      break
    }

    cache.delete(oldest)
  }
}

export function deleteRelatedCacheEntries(cache: Map<string, DiscoverEntity[]>, keys: Iterable<string>): void {
  for (const key of keys) {
    cache.delete(key)
  }
}

interface RemainingCountsInput {
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  relatedCache: Map<string, DiscoverEntity[]>
  replayQueueByNodeKey: Record<string, string[]>
  shouldSkipRelatedEntity: (parentNode: GraphNode, candidate: DiscoverEntity) => boolean
}

export function computeRemainingRelatedCountByNode({
  nodes,
  edges,
  relatedCache,
  replayQueueByNodeKey,
  shouldSkipRelatedEntity,
}: RemainingCountsInput): Record<string, number> {
  const remainingByNode: Record<string, number> = {}
  const connectedByNodeKey = new Map<string, Set<string>>()

  for (const edge of Object.values(edges)) {
    if (!nodes[edge.source] || !nodes[edge.target]) {
      continue
    }

    let sourceSet = connectedByNodeKey.get(edge.source)
    if (!sourceSet) {
      sourceSet = new Set<string>()
      connectedByNodeKey.set(edge.source, sourceSet)
    }
    sourceSet.add(edge.target)

    let targetSet = connectedByNodeKey.get(edge.target)
    if (!targetSet) {
      targetSet = new Set<string>()
      connectedByNodeKey.set(edge.target, targetSet)
    }
    targetSet.add(edge.source)
  }

  for (const node of Object.values(nodes)) {
    const related = relatedCache.get(node.key)

    if (!related) {
      remainingByNode[node.key] = 0
      continue
    }

    const connectedKeys = connectedByNodeKey.get(node.key) ?? new Set<string>()
    const countedKeys = new Set<string>()
    const queuedKeys = replayQueueByNodeKey[node.key] ?? []
    const relatedByKey = new Map<string, DiscoverEntity>()
    let remaining = 0

    for (const candidate of related) {
      relatedByKey.set(entityKey(candidate), candidate)
    }

    for (const queuedKey of queuedKeys) {
      if (countedKeys.has(queuedKey) || connectedKeys.has(queuedKey)) {
        continue
      }

      const candidate = relatedByKey.get(queuedKey)

      if (!candidate || shouldSkipRelatedEntity(node, candidate)) {
        continue
      }

      countedKeys.add(queuedKey)
      remaining += 1
    }

    for (let index = node.expansionCursor; index < related.length; index += 1) {
      const candidate = related[index]
      const candidateKey = entityKey(candidate)

      if (countedKeys.has(candidateKey) || connectedKeys.has(candidateKey)) {
        continue
      }

      if (!shouldSkipRelatedEntity(node, candidate)) {
        countedKeys.add(candidateKey)
        remaining += 1
      }
    }

    remainingByNode[node.key] = remaining
  }

  return remainingByNode
}
