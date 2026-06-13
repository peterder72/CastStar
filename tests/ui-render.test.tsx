import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../src/App'
import { getNodeVisualScale } from '../src/features/graph/components/GraphNodeBubble'

describe('App UI render', () => {
  it('renders without crashing', () => {
    expect(() => renderToString(<App />)).not.toThrow()
  })
})

describe('graph node visual scale', () => {
  it('shrinks gradually when zooming out and stays bounded', () => {
    expect(getNodeVisualScale(1)).toBe(1)
    expect(getNodeVisualScale(0.5)).toBe(0.8)
    expect(getNodeVisualScale(0.3)).toBe(0.72)
    expect(getNodeVisualScale(0.1)).toBe(0.72)
    expect(getNodeVisualScale(2)).toBe(1)
  })
})
