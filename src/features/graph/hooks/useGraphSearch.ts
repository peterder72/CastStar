import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from '../constants'
import { isAbortError, searchMulti } from '../../../tmdb'
import { entityKey, type DiscoverEntity } from '../../../types'

interface UseGraphSearchParams {
  hiddenEntityKeys: string[]
  addSearchEntity: (entity: DiscoverEntity) => boolean
  setErrorMessage: (message: string | null) => void
  onEntityAdded?: () => void
}

export function useGraphSearch({
  hiddenEntityKeys,
  addSearchEntity,
  setErrorMessage,
  onEntityAdded,
}: UseGraphSearchParams) {
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DiscoverEntity[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRequestRef = useRef(0)
  const activeSearchControllerRef = useRef<AbortController | null>(null)

  const hiddenKeySet = useMemo(() => new Set(hiddenEntityKeys), [hiddenEntityKeys])

  useEffect(() => {
    setSearchResults((current) => {
      const filtered = current.filter((item) => !hiddenKeySet.has(entityKey(item)))
      return filtered.length === current.length ? current : filtered
    })
  }, [hiddenKeySet])

  const chooseSearchResult = useCallback(
    (entity: DiscoverEntity): boolean => {
      const added = addSearchEntity(entity)

      if (!added) {
        return false
      }

      onEntityAdded?.()
      setQuery('')
      setSearchResults([])
      setSearchOpen(false)
      return true
    },
    [addSearchEntity, onEntityAdded],
  )

  const abortActiveSearch = useCallback((): void => {
    const activeController = activeSearchControllerRef.current

    if (!activeController) {
      return
    }

    activeController.abort()
    activeSearchControllerRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      abortActiveSearch()
    }
  }, [abortActiveSearch])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      abortActiveSearch()
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }

    abortActiveSearch()

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId
    const controller = new AbortController()
    activeSearchControllerRef.current = controller

    setSearchLoading(true)

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchMulti(trimmedQuery, {
            signal: controller.signal,
          })

          if (requestId !== searchRequestRef.current) {
            return
          }

          const filteredResults = results.filter((entity) => !hiddenKeySet.has(entityKey(entity)))
          setSearchResults(filteredResults)
          setSearchOpen(true)
        } catch (error) {
          if (isAbortError(error)) {
            return
          }

          if (requestId !== searchRequestRef.current) {
            return
          }

          setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
          setSearchResults([])
          setSearchOpen(false)
        } finally {
          if (requestId === searchRequestRef.current) {
            setSearchLoading(false)
            if (activeSearchControllerRef.current === controller) {
              activeSearchControllerRef.current = null
            }
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timerId)
      controller.abort()
      if (activeSearchControllerRef.current === controller) {
        activeSearchControllerRef.current = null
      }
    }
  }, [abortActiveSearch, hiddenKeySet, query, setErrorMessage])

  const submitSearch = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      const trimmedQuery = query.trim()

      if (trimmedQuery.length < 2) {
        return
      }

      if (searchResults.length > 0) {
        chooseSearchResult(searchResults[0])
        return
      }

      abortActiveSearch()
      const requestId = searchRequestRef.current + 1
      searchRequestRef.current = requestId
      const controller = new AbortController()
      activeSearchControllerRef.current = controller

      try {
        setSearchLoading(true)

        const results = await searchMulti(trimmedQuery, {
          signal: controller.signal,
        })

        if (requestId !== searchRequestRef.current) {
          return
        }

        const filteredResults = results.filter((entity) => !hiddenKeySet.has(entityKey(entity)))
        setSearchResults(filteredResults)
        setSearchOpen(true)

        if (filteredResults[0]) {
          chooseSearchResult(filteredResults[0])
        }
      } catch (error) {
        if (isAbortError(error)) {
          return
        }

        setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
      } finally {
        if (requestId === searchRequestRef.current) {
          setSearchLoading(false)
          if (activeSearchControllerRef.current === controller) {
            activeSearchControllerRef.current = null
          }
        }
      }
    },
    [abortActiveSearch, chooseSearchResult, hiddenKeySet, query, searchResults, setErrorMessage],
  )

  const handleQueryChange = useCallback(
    (value: string): void => {
      setQuery(value)
      setErrorMessage(null)
    },
    [setErrorMessage],
  )

  const handleSearchFocus = useCallback((): void => {
    if (searchResults.length > 0) {
      setSearchOpen(true)
    }
  }, [searchResults])

  const closeSearch = useCallback((): void => {
    setSearchOpen(false)
  }, [])

  return {
    query,
    searchLoading,
    searchResults,
    searchOpen,
    submitSearch,
    chooseSearchResult,
    handleQueryChange,
    handleSearchFocus,
    closeSearch,
  }
}
