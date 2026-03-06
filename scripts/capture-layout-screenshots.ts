import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium, devices, type Browser, type Page } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'

interface CliOptions {
  outDir: string
  route: string
  targetUrl: string | null
  openSettings: boolean
}

interface RunningServer {
  close: () => Promise<void>
  origin: string
}

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    outDir: 'artifacts/screenshots',
    route: '/',
    targetUrl: null,
    openSettings: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index]

    if (!current.startsWith('--')) {
      continue
    }

    const [key, maybeValue] = current.split('=')
    const nextValue = maybeValue ?? argv[index + 1]

    const consumeNext = (): string => {
      if (maybeValue) {
        return maybeValue
      }

      if (!nextValue || nextValue.startsWith('--')) {
        throw new Error(`Missing value for ${key}`)
      }

      index += 1
      return nextValue
    }

    if (key === '--out-dir') {
      options.outDir = consumeNext()
      continue
    }

    if (key === '--route') {
      options.route = consumeNext()
      continue
    }

    if (key === '--url') {
      options.targetUrl = consumeNext()
      continue
    }

    if (key === '--open-settings') {
      options.openSettings = true
      continue
    }

    if (key === '--help') {
      printHelp()
      process.exit(0)
    }

    throw new Error(`Unknown option ${key}`)
  }

  return options
}

function printHelp(): void {
  console.log('Capture CastStar screenshots for desktop and mobile viewports.')
  console.log(
    'Usage: npm run screenshot:layouts -- [--out-dir artifacts/screenshots] [--route /] [--url http://127.0.0.1:5173] [--open-settings]',
  )
}

function normalizeRoute(route: string): string {
  if (!route.startsWith('/')) {
    return `/${route}`
  }

  return route
}

async function startViteServer(): Promise<RunningServer> {
  const server: ViteDevServer = await createServer({
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
    },
    logLevel: 'error',
  })

  await server.listen()

  const origin = server.resolvedUrls?.local[0]

  if (!origin) {
    await server.close()
    throw new Error('Could not resolve local Vite dev URL.')
  }

  return {
    origin,
    close: async () => {
      await server.close()
    },
  }
}

async function openSettingsMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('dialog', { name: 'Settings menu' }).waitFor({ state: 'visible' })
}

async function run(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const outDir = path.resolve(options.outDir)
  await mkdir(outDir, { recursive: true })

  const route = normalizeRoute(options.route)
  let server: RunningServer | null = null
  let browser: Browser | null = null
  try {
    server = options.targetUrl ? null : await startViteServer()
    const origin = options.targetUrl ?? server?.origin

    if (!origin) {
      throw new Error('Missing target URL and failed to start local Vite server.')
    }

    const desktopPath = path.join(outDir, 'desktop.png')
    const mobilePath = path.join(outDir, 'mobile.png')
    const captureUrl = new URL(route, origin).toString()

    browser = await chromium.launch()

    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    })

    const desktopPage = await desktopContext.newPage()
    await desktopPage.goto(captureUrl, { waitUntil: 'networkidle' })
    if (options.openSettings) {
      await openSettingsMenu(desktopPage)
    }
    await desktopPage.waitForTimeout(1000)
    await desktopPage.screenshot({ path: desktopPath, fullPage: true })
    await desktopContext.close()

    const mobileContext = await browser.newContext({
      ...devices['iPhone 13'],
    })

    const mobilePage = await mobileContext.newPage()
    await mobilePage.goto(captureUrl, { waitUntil: 'networkidle' })
    if (options.openSettings) {
      await openSettingsMenu(mobilePage)
    }
    await mobilePage.waitForTimeout(1000)
    await mobilePage.screenshot({ path: mobilePath, fullPage: true })
    await mobileContext.close()

    console.log(`Desktop screenshot: ${desktopPath}`)
    console.log(`Mobile screenshot:  ${mobilePath}`)
  } finally {
    await browser?.close()
    await server?.close()
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)

  if (message.includes('Executable') && message.includes('playwright')) {
    console.error('Playwright browser binaries are missing. Run: npx playwright install chromium')
  }

  console.error(`Screenshot capture failed: ${message}`)
  process.exitCode = 1
})
