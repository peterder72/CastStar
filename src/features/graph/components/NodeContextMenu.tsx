import { memo, useEffect, useRef, useState } from 'react'
import { entityKey, type DiscoverEntity, type GraphNode } from '../../../types'
import Button from '../../../components/ui/Button'

interface ContextMenuPosition {
  left: number
  top: number
}

interface NodeContextMenuProps {
  node: GraphNode | null
  position: ContextMenuPosition | null
  onHideNode: (nodeKey: string) => void
  onPruneLeaves: (nodeKey: string) => void
  onDeleteNode: (nodeKey: string) => void
  onLoadRelatedSelectionOptions: (nodeKey: string) => Promise<DiscoverEntity[]>
  getConnectedNodeKeyList: (nodeKey: string) => string[]
  onAddSelectedRelations: (
    nodeKey: string,
    relationKeys: string[],
  ) => Promise<{
    added: number
    alreadyConnected: number
    hidden: number
    missing: number
  }>
}

function NodeContextMenu({
  node,
  position,
  onHideNode,
  onPruneLeaves,
  onDeleteNode,
  onLoadRelatedSelectionOptions,
  getConnectedNodeKeyList,
  onAddSelectedRelations,
}: NodeContextMenuProps) {
  const [manualSelectionOpen, setManualSelectionOpen] = useState(false)
  const [selectionQuery, setSelectionQuery] = useState('')
  const [selectionOptions, setSelectionOptions] = useState<DiscoverEntity[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [selectionLoading, setSelectionLoading] = useState(false)
  const [addingSelection, setAddingSelection] = useState(false)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null)
  const selectionRequestRef = useRef(0)

  useEffect(() => {
    setManualSelectionOpen(false)
    setSelectionQuery('')
    setSelectionOptions([])
    setSelectedKeys(new Set())
    setSelectionLoading(false)
    setAddingSelection(false)
    setSelectionError(null)
    setSelectionNotice(null)
    selectionRequestRef.current += 1
  }, [node?.key])

  if (!node || !position) {
    return null
  }

  const connectedKeySet = new Set(getConnectedNodeKeyList(node.key))
  const normalizedQuery = selectionQuery.trim().toLowerCase()
  const filteredOptions =
    normalizedQuery.length === 0
      ? selectionOptions
      : selectionOptions.filter((item) => {
          const searchableText = [
            item.title,
            item.subtitle,
            item.creditRole,
            item.kind,
            String(item.tmdbId),
          ]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase()

          return searchableText.includes(normalizedQuery)
        })

  let pendingSelectionCount = 0

  for (const key of selectedKeys) {
    if (!connectedKeySet.has(key)) {
      pendingSelectionCount += 1
    }
  }

  const handleToggleManualSelection = async (): Promise<void> => {
    const nextOpen = !manualSelectionOpen
    setManualSelectionOpen(nextOpen)
    setSelectionError(null)
    setSelectionNotice(null)

    if (!nextOpen || selectionOptions.length > 0 || selectionLoading) {
      return
    }

    const requestId = selectionRequestRef.current + 1
    selectionRequestRef.current = requestId
    setSelectionLoading(true)

    try {
      const options = await onLoadRelatedSelectionOptions(node.key)

      if (selectionRequestRef.current !== requestId) {
        return
      }

      setSelectionOptions(options)
    } catch (error) {
      if (selectionRequestRef.current !== requestId) {
        return
      }

      const message = error instanceof Error ? error.message : 'Failed to load related entities.'
      setSelectionError(message)
    } finally {
      if (selectionRequestRef.current === requestId) {
        setSelectionLoading(false)
      }
    }
  }

  const handleToggleSelection = (key: string): void => {
    setSelectedKeys((current) => {
      const next = new Set(current)

      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }

      return next
    })
  }

  const handleAddSelected = async (): Promise<void> => {
    const keysToAdd = Array.from(selectedKeys).filter((key) => !connectedKeySet.has(key))

    if (keysToAdd.length === 0) {
      return
    }

    setSelectionError(null)
    setSelectionNotice(null)
    setAddingSelection(true)

    try {
      const result = await onAddSelectedRelations(node.key, keysToAdd)
      setSelectedKeys(new Set())

      if (result.added === 0) {
        setSelectionNotice('No new connections were added.')
        return
      }

      const details = [`Added ${result.added}`]

      if (result.alreadyConnected > 0) {
        details.push(`${result.alreadyConnected} already connected`)
      }

      if (result.hidden > 0) {
        details.push(`${result.hidden} hidden`)
      }

      if (result.missing > 0) {
        details.push(`${result.missing} unavailable`)
      }

      setSelectionNotice(details.join(' • '))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add selected relations.'
      setSelectionError(message)
    } finally {
      setAddingSelection(false)
    }
  }

  return (
    <div
      className="fixed z-[120] grid w-[min(22rem,calc(100vw-20px))] gap-1.5 rounded-xl border border-slate-500/70 bg-slate-950/95 p-2 shadow-[0_18px_36px_rgba(0,0,0,0.45)] backdrop-blur-md"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <strong className="break-words px-1 pb-0.5 text-[0.82rem] leading-tight whitespace-normal text-slate-100">{node.title}</strong>
      <Button size="sm" onClick={() => onHideNode(node.key)}>
        Hide Node (to hidden list)
      </Button>
      <Button size="sm" onClick={() => onPruneLeaves(node.key)}>
        Prune Loose Children
      </Button>
      <Button size="sm" tone="danger" onClick={() => onDeleteNode(node.key)}>
        Delete Node
      </Button>

      <Button size="sm" onClick={() => void handleToggleManualSelection()}>
        {manualSelectionOpen ? 'Hide Manual Select' : 'Manual Select Related'}
      </Button>

      {manualSelectionOpen && (
        <div className="mt-1 grid gap-2 rounded-lg border border-slate-500/65 bg-slate-900/55 p-2">
          <input
            type="text"
            value={selectionQuery}
            onChange={(event) => setSelectionQuery(event.target.value)}
            placeholder="Search movie, actor, role..."
            className="h-8 w-full rounded-md border border-slate-500/70 bg-slate-950/90 px-2.5 text-[0.76rem] text-slate-100 placeholder:text-slate-400 focus:border-cyan-300/60 focus:outline-none"
          />

          <div className="max-h-64 overflow-y-auto pr-1">
            {selectionLoading && <p className="text-[0.75rem] text-cyan-200">Loading related entities...</p>}

            {!selectionLoading && selectionError && <p className="text-[0.75rem] text-rose-200">{selectionError}</p>}

            {!selectionLoading && !selectionError && filteredOptions.length === 0 && (
              <p className="text-[0.75rem] text-slate-300">
                {selectionOptions.length === 0 ? 'No related entities found.' : 'No matches for this search.'}
              </p>
            )}

            {!selectionLoading && !selectionError && filteredOptions.length > 0 && (
              <ul className="grid gap-1">
                {filteredOptions.map((entity) => {
                  const key = entityKey(entity)
                  const connected = connectedKeySet.has(key)
                  const checked = selectedKeys.has(key)

                  return (
                    <li key={key}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-600/60 bg-slate-950/70 p-1.5">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={connected}
                          onChange={() => handleToggleSelection(key)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-slate-400/80 bg-slate-900"
                        />
                        <span className="min-w-0 text-[0.73rem] leading-tight text-slate-100">
                          <strong className="block break-words">{entity.title}</strong>
                          {entity.subtitle && <small className="block break-words text-slate-300">{entity.subtitle}</small>}
                          <small className="block break-words text-cyan-200">
                            {entity.kind.toUpperCase()}
                            {connected ? ' • Already linked' : ''}
                          </small>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <Button size="sm" disabled={addingSelection || pendingSelectionCount === 0} onClick={() => void handleAddSelected()}>
            {addingSelection ? 'Adding...' : `Add Selected (${pendingSelectionCount})`}
          </Button>

          {selectionNotice && <p className="text-[0.72rem] text-cyan-200">{selectionNotice}</p>}
        </div>
      )}
    </div>
  )
}

export default memo(NodeContextMenu)
