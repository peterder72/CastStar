export type NodeKind = 'person' | 'movie' | 'tv'

export interface DiscoverEntity {
  kind: NodeKind
  tmdbId: number
  title: string
  subtitle?: string
  creditRole?: string
  creditCategory?: 'cast' | 'crew'
  creditDepartment?: string
  imagePath: string | null
}

export interface NodePhysics {
  mass: number
  repulsion: number
  springLength: number
  springStrength: number
  damping: number
  clusterPull: number
  maxSpeed: number
}

export interface GraphNode extends DiscoverEntity {
  key: string
  x: number
  y: number
  vx: number
  vy: number
  expansionCursor: number
  totalRelated: number
  loading: boolean
}

export interface GraphEdge {
  key: string
  source: string
  target: string
}

export function entityKey(entity: Pick<DiscoverEntity, 'kind' | 'tmdbId'>): string {
  return `${entity.kind}:${entity.tmdbId}`
}
