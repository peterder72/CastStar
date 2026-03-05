import { performance } from 'node:perf_hooks'
import { DEFAULT_PHYSICS } from '../src/features/graph/constants'
import { stepGraphPhysics } from '../src/features/graph/physics'
import type { GraphEdge, GraphNode } from '../src/types'

interface BenchmarkScenario {
  edgesPerNode: number
  name: string
  nodes: number
  steps: number
  warmupSteps: number
}

interface BenchmarkResult {
  maxMs: number
  meanMs: number
  p95Ms: number
  scenario: BenchmarkScenario
}

function createRandom(seed: number): () => number {
  let current = seed >>> 0

  return () => {
    current = (1664525 * current + 1013904223) >>> 0
    return current / 4294967296
  }
}

function generateGraph(nodeCount: number, edgesPerNode: number, seed: number): {
  edges: Record<string, GraphEdge>
  nodes: Record<string, GraphNode>
} {
  const random = createRandom(seed)
  const nodes: Record<string, GraphNode> = {}

  for (let index = 0; index < nodeCount; index += 1) {
    const key = `person:${index}`
    nodes[key] = {
      key,
      kind: 'person',
      tmdbId: index,
      title: `Node ${index}`,
      imagePath: null,
      x: (random() - 0.5) * 4200,
      y: (random() - 0.5) * 4200,
      vx: 0,
      vy: 0,
      expansionCursor: 0,
      totalRelated: 0,
      loading: false,
    }
  }

  const edgePairs = new Set<string>()

  const addEdgePair = (left: number, right: number): void => {
    if (left === right) {
      return
    }

    const sourceIndex = Math.min(left, right)
    const targetIndex = Math.max(left, right)
    edgePairs.add(`${sourceIndex}|${targetIndex}`)
  }

  for (let index = 0; index < nodeCount; index += 1) {
    addEdgePair(index, (index + 1) % nodeCount)
  }

  const randomEdges = Math.floor(nodeCount * edgesPerNode)

  for (let index = 0; index < randomEdges; index += 1) {
    const left = Math.floor(random() * nodeCount)
    const right = Math.floor(random() * nodeCount)
    addEdgePair(left, right)
  }

  const edges: Record<string, GraphEdge> = {}
  let edgeIndex = 0

  for (const pair of edgePairs) {
    const [sourceIndexText, targetIndexText] = pair.split('|')
    const source = `person:${sourceIndexText}`
    const target = `person:${targetIndexText}`
    const key = `${source}|${target}|${edgeIndex}`

    edges[key] = {
      key,
      source,
      target,
    }

    edgeIndex += 1
  }

  return { nodes, edges }
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.floor(values.length * ratio)))
  return values[index]
}

function runScenario(scenario: BenchmarkScenario): BenchmarkResult {
  const { nodes, edges } = generateGraph(scenario.nodes, scenario.edgesPerNode, scenario.nodes * 37 + 11)
  let activeNodes = nodes

  for (let index = 0; index < scenario.warmupSteps; index += 1) {
    activeNodes = stepGraphPhysics({
      nodes: activeNodes,
      edges,
      settings: DEFAULT_PHYSICS,
      dt: 1,
    }).nextNodes
  }

  const samples: number[] = []

  for (let index = 0; index < scenario.steps; index += 1) {
    const startedAt = performance.now()
    activeNodes = stepGraphPhysics({
      nodes: activeNodes,
      edges,
      settings: DEFAULT_PHYSICS,
      dt: 1,
    }).nextNodes
    samples.push(performance.now() - startedAt)
  }

  samples.sort((left, right) => left - right)

  const total = samples.reduce((sum, value) => sum + value, 0)
  const meanMs = total / samples.length

  return {
    scenario,
    meanMs,
    p95Ms: percentile(samples, 0.95),
    maxMs: samples[samples.length - 1] ?? 0,
  }
}

function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`
}

function printResult(result: BenchmarkResult): void {
  const budgetShare = (result.meanMs / 16.667) * 100
  const theoreticalFps = 1000 / Math.max(0.001, result.meanMs)
  const edgeEstimate = Math.round(result.scenario.nodes * result.scenario.edgesPerNode)

  console.log(
    `${result.scenario.name.padEnd(20)} | ${String(result.scenario.nodes).padStart(4)} nodes | ~${String(edgeEstimate).padStart(4)} rnd edges | avg ${formatMs(result.meanMs)} | p95 ${formatMs(result.p95Ms)} | max ${formatMs(result.maxMs)} | budget ${budgetShare.toFixed(1).padStart(5)}% | max fps ${theoreticalFps.toFixed(1).padStart(6)}`,
  )
}

const scenarios: BenchmarkScenario[] = [
  { name: 'Small Graph', nodes: 80, edgesPerNode: 2.6, warmupSteps: 120, steps: 420 },
  { name: 'Medium Graph', nodes: 180, edgesPerNode: 2.8, warmupSteps: 140, steps: 380 },
  { name: 'Large Graph', nodes: 320, edgesPerNode: 3, warmupSteps: 180, steps: 340 },
  { name: 'Stress Graph', nodes: 520, edgesPerNode: 3.1, warmupSteps: 220, steps: 320 },
]

console.log('Physics benchmark (stepGraphPhysics, dt=1, default settings)')
console.log('Scenario             | Nodes      | Random links   | Metrics')
console.log('-----------------------------------------------------------------------------------------------')

for (const scenario of scenarios) {
  printResult(runScenario(scenario))
}
