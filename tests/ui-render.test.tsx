import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import App from '../src/App'

describe('App UI render', () => {
  it('renders without crashing', () => {
    expect(() => renderToString(<App />)).not.toThrow()
  })
})
