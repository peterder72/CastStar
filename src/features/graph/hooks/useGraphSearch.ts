import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEARCH_DEBOUNCE_MS } from '../constants'
import { searchMulti } from '../../../tmdb'
import { entityKey, type DiscoverEntity } from '../../../types'

interface UseGraphSearchParams {
  hiddenEntityKeys: string[]
  addSearchEntity: (entity: DiscoverEntity) => boolean
  setErrorMessage: (message: string | null) => void
}

export function useGraphSearch({ hiddenEntityKeys, addSearchEntity, setErrorMessage }: UseGraphSearchParams) {
  const [query, setQuery] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<DiscoverEntity[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRequestRef = useRef(0)

  const hiddenKeySet = useMemo(() => new Set(hiddenEntityKeys), [hiddenEntityKeys])

  useEffect(() => {
    setSearchResults((current) => {
      const filtered = current.filter((item) => !hiddenKeySet.has(entityKey(item)))
      return filtered.length === current.length ? current : filtered
    })
  }, [hiddenKeySet])

  const chooseSearchResult = useCallback(
    (entity: DiscoverEntity): void => {
      const added = addSearchEntity(entity)

      if (!added) {
        return
      }

      setQuery('')
      setSearchResults([])
      setSearchOpen(false)
    },
    [addSearchEntity],
  )

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (trimmedQuery.length < 2) {
      setSearchResults([])
      setSearchOpen(false)
      setSearchLoading(false)
      return
    }

    const requestId = searchRequestRef.current + 1
    searchRequestRef.current = requestId

    setSearchLoading(true)

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          const results = await searchMulti(trimmedQuery)

          if (requestId !== searchRequestRef.current) {
            return
          }

          const filteredResults = results.filter((entity) => !hiddenKeySet.has(entityKey(entity)))
          setSearchResults(filteredResults)
          setSearchOpen(true)
        } catch (error) {
          if (requestId !== searchRequestRef.current) {
            return
          }

          setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
          setSearchResults([])
          setSearchOpen(false)
        } finally {
          if (requestId === searchRequestRef.current) {
            setSearchLoading(false)
          }
        }
      })()
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [hiddenKeySet, query, setErrorMessage])

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

      try {
        setSearchLoading(true)
        const results = await searchMulti(trimmedQuery)
        const filteredResults = results.filter((entity) => !hiddenKeySet.has(entityKey(entity)))
        setSearchResults(filteredResults)
        setSearchOpen(true)

        if (filteredResults[0]) {
          chooseSearchResult(filteredResults[0])
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Search request failed.')
      } finally {
        setSearchLoading(false)
      }
    },
    [chooseSearchResult, hiddenKeySet, query, searchResults, setErrorMessage],
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
