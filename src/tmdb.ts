import { entityKey, type DiscoverEntity, type NodeKind } from './types'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w185'

const RAW_SECRET =
  import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN ??
  import.meta.env.VITE_TMDB_API_KEY ??
  (typeof __TMDB_API_KEY__ === 'string' ? __TMDB_API_KEY__ : '')

const TMDB_SECRET = RAW_SECRET.trim()
const USE_BEARER_AUTH = TMDB_SECRET.includes('.') && TMDB_SECRET.length > 40

interface MultiSearchResponse {
  results: MultiSearchItem[]
}

interface MultiSearchItem {
  media_type: 'person' | 'movie' | 'tv' | string
  id: number
  name?: string
  title?: string
  profile_path?: string | null
  poster_path?: string | null
  known_for_department?: string
  release_date?: string
  first_air_date?: string
}

interface CreditsResponse {
  cast: CastPerson[]
}

interface CastPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  character?: string
  order?: number
}

interface CombinedCreditsResponse {
  cast: CombinedCredit[]
}

interface CombinedCredit {
  id: number
  media_type: 'movie' | 'tv' | string
  title?: string
  name?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  character?: string
  popularity?: number
  vote_count?: number
}

interface RankedEntity {
  entity: DiscoverEntity
  popularity: number
  dateScore: number
  voteCount: number
}

function ensureConfigured(): void {
  if (!TMDB_SECRET) {
    throw new Error('TMDB API key is missing. Add TMDB_API_KEY to your .env file.')
  }
}

function buildUrl(path: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(`${TMDB_BASE_URL}${path}`)

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) {
      continue
    }

    url.searchParams.set(key, String(value))
  }

  if (!USE_BEARER_AUTH) {
    url.searchParams.set('api_key', TMDB_SECRET)
  }

  return url.toString()
}

async function tmdbFetch<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<T> {
  ensureConfigured()

  const headers: HeadersInit = USE_BEARER_AUTH
    ? {
        Authorization: `Bearer ${TMDB_SECRET}`,
      }
    : {}

  const response = await fetch(buildUrl(path, params), { headers })

  if (!response.ok) {
    const responseText = await response.text()
    const compactBody = responseText.slice(0, 160).replace(/\s+/g, ' ').trim()
    throw new Error(`TMDB request failed (${response.status}): ${compactBody || 'Unknown error'}`)
  }

  return (await response.json()) as T
}

function yearFromDate(value?: string): string | undefined {
  if (!value || value.length < 4) {
    return undefined
  }

  return value.slice(0, 4)
}

function toMediaEntity(
  kind: Exclude<NodeKind, 'person'>,
  id: number,
  title: string,
  imagePath: string | null,
  date?: string,
  role?: string,
): DiscoverEntity {
  const year = yearFromDate(date)
  const subtitleParts = [year, role].filter((item): item is string => Boolean(item))

  return {
    kind,
    tmdbId: id,
    title,
    subtitle: subtitleParts.join(' • ') || undefined,
    creditRole: role || undefined,
    imagePath,
  }
}

function toPersonEntity(raw: Pick<CastPerson, 'id' | 'name' | 'profile_path' | 'known_for_department' | 'character'>): DiscoverEntity {
  return {
    kind: 'person',
    tmdbId: raw.id,
    title: raw.name,
    subtitle: raw.character ?? raw.known_for_department ?? 'Actor',
    imagePath: raw.profile_path ?? null,
  }
}

function toMultiResultEntity(item: MultiSearchItem): DiscoverEntity | null {
  if (item.media_type === 'person' && item.name) {
    return {
      kind: 'person',
      tmdbId: item.id,
      title: item.name,
      subtitle: item.known_for_department ?? 'Person',
      imagePath: item.profile_path ?? null,
    }
  }

  if (item.media_type === 'movie' && item.title) {
    return toMediaEntity('movie', item.id, item.title, item.poster_path ?? null, item.release_date)
  }

  if (item.media_type === 'tv' && item.name) {
    return toMediaEntity('tv', item.id, item.name, item.poster_path ?? null, item.first_air_date)
  }

  return null
}

function toRankedMediaEntity(item: CombinedCredit): RankedEntity | null {
  if (item.media_type === 'movie' && item.title) {
    return {
      entity: toMediaEntity(
        'movie',
        item.id,
        item.title,
        item.poster_path ?? null,
        item.release_date,
        item.character,
      ),
      popularity: item.popularity ?? 0,
      dateScore: Date.parse(item.release_date ?? '') || 0,
      voteCount: item.vote_count ?? 0,
    }
  }

  if (item.media_type === 'tv' && item.name) {
    return {
      entity: toMediaEntity('tv', item.id, item.name, item.poster_path ?? null, item.first_air_date, item.character),
      popularity: item.popularity ?? 0,
      dateScore: Date.parse(item.first_air_date ?? '') || 0,
      voteCount: item.vote_count ?? 0,
    }
  }

  return null
}

function uniqueEntities(entities: DiscoverEntity[]): DiscoverEntity[] {
  const uniqueMap = new Map<string, DiscoverEntity>()

  for (const item of entities) {
    uniqueMap.set(entityKey(item), item)
  }

  return Array.from(uniqueMap.values())
}

export function getImageUrl(imagePath: string | null): string | null {
  if (!imagePath) {
    return null
  }

  return `${TMDB_IMAGE_URL}${imagePath}`
}

export async function searchMulti(query: string): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<MultiSearchResponse>('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1,
  })

  const mapped = data.results
    .map(toMultiResultEntity)
    .filter((item): item is DiscoverEntity => item !== null)

  return uniqueEntities(mapped).slice(0, 20)
}

async function fetchMovieCast(movieId: number): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CreditsResponse>(`/movie/${movieId}/credits`, { language: 'en-US' })

  const ranked = [...data.cast].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  return uniqueEntities(ranked.map(toPersonEntity))
}

async function fetchTvCast(tvId: number): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CreditsResponse>(`/tv/${tvId}/credits`, { language: 'en-US' })

  const ranked = [...data.cast].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  return uniqueEntities(ranked.map(toPersonEntity))
}

async function fetchPersonTitles(personId: number): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CombinedCreditsResponse>(`/person/${personId}/combined_credits`, {
    language: 'en-US',
  })

  const rankedMap = new Map<string, RankedEntity>()

  for (const item of data.cast) {
    const rankedEntity = toRankedMediaEntity(item)

    if (!rankedEntity) {
      continue
    }

    const key = entityKey(rankedEntity.entity)
    const existing = rankedMap.get(key)

    if (!existing) {
      rankedMap.set(key, rankedEntity)
      continue
    }

    const candidateWins =
      rankedEntity.popularity > existing.popularity ||
      (rankedEntity.popularity === existing.popularity && rankedEntity.voteCount > existing.voteCount)

    if (candidateWins) {
      rankedMap.set(key, rankedEntity)
    }
  }

  return Array.from(rankedMap.values())
    .sort((left, right) => {
      if (right.popularity !== left.popularity) {
        return right.popularity - left.popularity
      }

      if (right.voteCount !== left.voteCount) {
        return right.voteCount - left.voteCount
      }

      return right.dateScore - left.dateScore
    })
    .map((item) => item.entity)
}

export async function fetchRelatedEntities(entity: Pick<DiscoverEntity, 'kind' | 'tmdbId'>): Promise<DiscoverEntity[]> {
  if (entity.kind === 'person') {
    return fetchPersonTitles(entity.tmdbId)
  }

  if (entity.kind === 'movie') {
    return fetchMovieCast(entity.tmdbId)
  }

  return fetchTvCast(entity.tmdbId)
}
