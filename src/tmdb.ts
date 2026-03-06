import { entityKey, type DiscoverEntity, type NodeKind } from './types'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_URL = 'https://image.tmdb.org/t/p/w185'
const DEMO_CHILD_COUNT = 10
const DEMO_KIND_SEQUENCE: NodeKind[] = ['person', 'movie', 'tv']
const RELEVANT_CREW_DEPARTMENTS = new Set(['Directing', 'Writing'])

const LOCAL_STORAGE_TOKEN_KEY = 'caststar_tmdb_token'

function parseBooleanEnvValue(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on'
}

const BUILD_SECRET = (
  import.meta.env.VITE_TMDB_READ_ACCESS_TOKEN ??
  import.meta.env.VITE_TMDB_API_KEY ??
  (typeof __TMDB_API_KEY__ === 'string' ? __TMDB_API_KEY__ : '')
).trim()

const RAW_DEMO_FLAG =
  import.meta.env.VITE_CASTSTAR_DEMO ??
  (typeof __CASTSTAR_DEMO__ === 'string' ? __CASTSTAR_DEMO__ : '')
const DEMO_EXPLICITLY_REQUESTED = parseBooleanEnvValue(RAW_DEMO_FLAG)

function readStoredToken(): string {
  if (typeof localStorage === 'undefined') {
    return ''
  }

  try {
    return (localStorage.getItem(LOCAL_STORAGE_TOKEN_KEY) ?? '').trim()
  } catch {
    return ''
  }
}

const STORED_TOKEN = readStoredToken()
const TMDB_SECRET = BUILD_SECRET || STORED_TOKEN
const USE_BEARER_AUTH = TMDB_SECRET.includes('.') && TMDB_SECRET.length > 40
const DEMO_MODE = DEMO_EXPLICITLY_REQUESTED || !TMDB_SECRET
export const isDemoModeEnabled = DEMO_MODE

export const isTokenConfigurable = !BUILD_SECRET && !DEMO_EXPLICITLY_REQUESTED

export function getUserToken(): string {
  return STORED_TOKEN
}

export function setUserToken(token: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  const trimmed = token.trim()

  if (trimmed) {
    localStorage.setItem(LOCAL_STORAGE_TOKEN_KEY, trimmed)
  } else {
    localStorage.removeItem(LOCAL_STORAGE_TOKEN_KEY)
  }

  window.location.reload()
}

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
  crew: CrewPerson[]
}

interface CastPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  character?: string
  order?: number
}

interface CrewPerson {
  id: number
  name: string
  profile_path: string | null
  known_for_department?: string
  department?: string
  job?: string
}

interface CombinedCreditsResponse {
  cast: CombinedCredit[]
  crew: CombinedCredit[]
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
  department?: string
  job?: string
  popularity?: number
  vote_count?: number
}

interface RankedEntity {
  entity: DiscoverEntity
  popularity: number
  dateScore: number
  voteCount: number
  creditCategoryPriority: number
}

interface RequestOptions {
  signal?: AbortSignal
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

function demoHash(value: string): number {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0) + 1
}

function toDemoSearchEntity(query: string): DiscoverEntity {
  const title = query.trim() || 'Test'

  return {
    kind: 'person',
    tmdbId: demoHash(`search:${title}`),
    title,
    subtitle: 'Demo result',
    imagePath: null,
  }
}

function toDemoRelatedEntities(entity: Pick<DiscoverEntity, 'kind' | 'tmdbId'>): DiscoverEntity[] {
  const key = `${entity.kind}:${entity.tmdbId}`

  return Array.from({ length: DEMO_CHILD_COUNT }, (_, index) => {
    const order = index + 1
    const kind = DEMO_KIND_SEQUENCE[index % DEMO_KIND_SEQUENCE.length]

    return {
      kind,
      tmdbId: demoHash(`${key}:related:${order}`),
      title: `Test_${order}`,
      imagePath: null,
    }
  })
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
  options: RequestOptions = {},
): Promise<T> {
  ensureConfigured()

  const headers: HeadersInit = USE_BEARER_AUTH
    ? {
        Authorization: `Bearer ${TMDB_SECRET}`,
      }
    : {}

  const response = await fetch(buildUrl(path, params), {
    headers,
    signal: options.signal,
  })

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

function isRelevantCrewDepartment(department?: string): boolean {
  if (!department) {
    return false
  }

  return RELEVANT_CREW_DEPARTMENTS.has(department)
}

function formatCrewRole(job?: string, department?: string): string | undefined {
  const roleParts = [job, department].filter((item): item is string => Boolean(item))
  return roleParts.join(' • ') || undefined
}

function toMediaEntity(
  kind: Exclude<NodeKind, 'person'>,
  id: number,
  title: string,
  imagePath: string | null,
  date?: string,
  role?: string,
  creditCategory?: 'cast' | 'crew',
  creditDepartment?: string,
): DiscoverEntity {
  const year = yearFromDate(date)
  const subtitleParts = [year, role].filter((item): item is string => Boolean(item))

  return {
    kind,
    tmdbId: id,
    title,
    subtitle: subtitleParts.join(' • ') || undefined,
    creditRole: role || undefined,
    creditCategory,
    creditDepartment,
    imagePath,
  }
}

function toCastPersonEntity(raw: Pick<CastPerson, 'id' | 'name' | 'profile_path' | 'known_for_department' | 'character'>): DiscoverEntity {
  return {
    kind: 'person',
    tmdbId: raw.id,
    title: raw.name,
    subtitle: raw.character ?? raw.known_for_department ?? 'Actor',
    creditRole: raw.character ?? undefined,
    creditCategory: 'cast',
    imagePath: raw.profile_path ?? null,
  }
}

function toCrewPersonEntity(raw: Pick<CrewPerson, 'id' | 'name' | 'profile_path' | 'known_for_department' | 'department' | 'job'>): DiscoverEntity {
  const role = formatCrewRole(raw.job, raw.department) ?? raw.known_for_department ?? 'Crew'

  return {
    kind: 'person',
    tmdbId: raw.id,
    title: raw.name,
    subtitle: role,
    creditRole: raw.job ?? raw.department ?? undefined,
    creditCategory: 'crew',
    creditDepartment: raw.department,
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

function toRankedMediaEntity(item: CombinedCredit, creditCategory: 'cast' | 'crew'): RankedEntity | null {
  if (creditCategory === 'crew' && !isRelevantCrewDepartment(item.department)) {
    return null
  }

  const role = creditCategory === 'crew' ? formatCrewRole(item.job, item.department) : item.character

  if (item.media_type === 'movie' && item.title) {
    return {
      entity: toMediaEntity(
        'movie',
        item.id,
        item.title,
        item.poster_path ?? null,
        item.release_date,
        role,
        creditCategory,
        item.department,
      ),
      popularity: item.popularity ?? 0,
      dateScore: Date.parse(item.release_date ?? '') || 0,
      voteCount: item.vote_count ?? 0,
      creditCategoryPriority: creditCategory === 'cast' ? 1 : 0,
    }
  }

  if (item.media_type === 'tv' && item.name) {
    return {
      entity: toMediaEntity(
        'tv',
        item.id,
        item.name,
        item.poster_path ?? null,
        item.first_air_date,
        role,
        creditCategory,
        item.department,
      ),
      popularity: item.popularity ?? 0,
      dateScore: Date.parse(item.first_air_date ?? '') || 0,
      voteCount: item.vote_count ?? 0,
      creditCategoryPriority: creditCategory === 'cast' ? 1 : 0,
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

export async function searchMulti(query: string, options: RequestOptions = {}): Promise<DiscoverEntity[]> {
  if (DEMO_MODE) {
    return [toDemoSearchEntity(query)]
  }

  const data = await tmdbFetch<MultiSearchResponse>('/search/multi', {
    query,
    include_adult: false,
    language: 'en-US',
    page: 1,
  }, options)

  const mapped = data.results
    .map(toMultiResultEntity)
    .filter((item): item is DiscoverEntity => item !== null)

  return uniqueEntities(mapped).slice(0, 20)
}

async function fetchMovieCast(movieId: number, options: RequestOptions = {}): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CreditsResponse>(`/movie/${movieId}/credits`, { language: 'en-US' }, options)

  const rankedCast = [...data.cast].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  const rankedCrew = data.crew
    .filter((person) => isRelevantCrewDepartment(person.department))
    .sort((left, right) => {
      const leftDepartment = left.department ?? ''
      const rightDepartment = right.department ?? ''
      if (leftDepartment !== rightDepartment) {
        return leftDepartment.localeCompare(rightDepartment)
      }

      const leftJob = left.job ?? ''
      const rightJob = right.job ?? ''
      if (leftJob !== rightJob) {
        return leftJob.localeCompare(rightJob)
      }

      return left.name.localeCompare(right.name)
    })

  const deduped = new Map<string, DiscoverEntity>()

  for (const person of rankedCast) {
    const entity = toCastPersonEntity(person)
    deduped.set(entityKey(entity), entity)
  }

  for (const person of rankedCrew) {
    const entity = toCrewPersonEntity(person)
    const key = entityKey(entity)

    if (!deduped.has(key)) {
      deduped.set(key, entity)
    }
  }

  return Array.from(deduped.values())
}

async function fetchTvCast(tvId: number, options: RequestOptions = {}): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CreditsResponse>(`/tv/${tvId}/credits`, { language: 'en-US' }, options)

  const rankedCast = [...data.cast].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  const rankedCrew = data.crew
    .filter((person) => isRelevantCrewDepartment(person.department))
    .sort((left, right) => {
      const leftDepartment = left.department ?? ''
      const rightDepartment = right.department ?? ''
      if (leftDepartment !== rightDepartment) {
        return leftDepartment.localeCompare(rightDepartment)
      }

      const leftJob = left.job ?? ''
      const rightJob = right.job ?? ''
      if (leftJob !== rightJob) {
        return leftJob.localeCompare(rightJob)
      }

      return left.name.localeCompare(right.name)
    })

  const deduped = new Map<string, DiscoverEntity>()

  for (const person of rankedCast) {
    const entity = toCastPersonEntity(person)
    deduped.set(entityKey(entity), entity)
  }

  for (const person of rankedCrew) {
    const entity = toCrewPersonEntity(person)
    const key = entityKey(entity)

    if (!deduped.has(key)) {
      deduped.set(key, entity)
    }
  }

  return Array.from(deduped.values())
}

async function fetchPersonTitles(personId: number, options: RequestOptions = {}): Promise<DiscoverEntity[]> {
  const data = await tmdbFetch<CombinedCreditsResponse>(`/person/${personId}/combined_credits`, {
    language: 'en-US',
  }, options)

  const rankedMap = new Map<string, RankedEntity>()

  for (const item of data.cast) {
    const rankedEntity = toRankedMediaEntity(item, 'cast')
 
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
      (rankedEntity.popularity === existing.popularity && rankedEntity.voteCount > existing.voteCount) ||
      (rankedEntity.popularity === existing.popularity &&
        rankedEntity.voteCount === existing.voteCount &&
        rankedEntity.dateScore > existing.dateScore) ||
      (rankedEntity.popularity === existing.popularity &&
        rankedEntity.voteCount === existing.voteCount &&
        rankedEntity.dateScore === existing.dateScore &&
        rankedEntity.creditCategoryPriority > existing.creditCategoryPriority)

    if (candidateWins) {
      rankedMap.set(key, rankedEntity)
    }
  }

  for (const item of data.crew) {
    const rankedEntity = toRankedMediaEntity(item, 'crew')

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
      (rankedEntity.popularity === existing.popularity && rankedEntity.voteCount > existing.voteCount) ||
      (rankedEntity.popularity === existing.popularity &&
        rankedEntity.voteCount === existing.voteCount &&
        rankedEntity.dateScore > existing.dateScore) ||
      (rankedEntity.popularity === existing.popularity &&
        rankedEntity.voteCount === existing.voteCount &&
        rankedEntity.dateScore === existing.dateScore &&
        rankedEntity.creditCategoryPriority > existing.creditCategoryPriority)

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

export async function fetchRelatedEntities(
  entity: Pick<DiscoverEntity, 'kind' | 'tmdbId'>,
  options: RequestOptions = {},
): Promise<DiscoverEntity[]> {
  if (DEMO_MODE) {
    return toDemoRelatedEntities(entity)
  }

  if (entity.kind === 'person') {
    return fetchPersonTitles(entity.tmdbId, options)
  }

  if (entity.kind === 'movie') {
    return fetchMovieCast(entity.tmdbId, options)
  }

  return fetchTvCast(entity.tmdbId, options)
}
