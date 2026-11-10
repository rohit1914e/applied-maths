import { expect, test, type Page } from '@playwright/test'

const SECTIONS = ['overview', 'simulation', 'missing-data', 'dataset', 'methods', 'reconstruction', 'evaluation', 'conclusion']

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  return errors
}

async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Network Latency Predictor' })).toBeVisible()
}

const counter = async (page: Page) => Number((await page.getByTestId('probe-counter').textContent())!.replace(/\D/g, ''))

async function scrollTo(page: Page, id: string) {
  await page.evaluate((i) => document.getElementById(i)!.scrollIntoView({ behavior: 'instant', block: 'start' }), id)
}

test('opens as a website: navbar, hero, live network, no presentation chrome', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page)
  const nav = page.getByRole('navigation', { name: 'Main' })
  for (const name of ['Overview', 'Network Simulation', 'Dataset', 'Methods', 'Reconstruction', 'Evaluation']) await expect(nav.getByRole('link', { name })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Explore the simulation' })).toBeVisible()
  // packets move in the hero
  const dots = () => page.locator('[data-testid="live-network"]').first().locator('circle[fill="#c18b52"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('cx')}:${e.getAttribute('opacity')}`).join('|'))
  const a = await dots()
  await page.waitForTimeout(400)
  expect(await dots()).not.toBe(a)
  await expect(page.getByTestId('stage')).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Presentation controls' })).toHaveCount(0)
  // the page scrolls normally
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(4000)
  expect(errors).toEqual([])
})

test('navigation links scroll to their sections and highlight the current one', async ({ page }) => {
  await open(page)
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Methods' }).click()
  await expect(page.locator('#methods')).toBeInViewport()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Methods' })).toHaveAttribute('aria-current', 'true')
  await page.getByRole('link', { name: 'Explore the simulation' }).count() // still present in the hero
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Overview' }).click()
  await expect(page.locator('#overview')).toBeInViewport()
})

test('simulation: pause, resume, speed, reset and off-screen pausing', async ({ page }) => {
  await open(page)
  await page.getByRole('link', { name: 'Explore the simulation' }).click()
  const sim = page.locator('#simulation')
  await expect(sim.getByTestId('sim-status')).toHaveText('Running at 1×')
  const start = await counter(page)
  await page.waitForTimeout(2500)
  expect(await counter(page)).toBeGreaterThan(start)

  await sim.getByRole('button', { name: 'Pause' }).click()
  const frozen = await counter(page)
  await page.waitForTimeout(2000)
  expect(await counter(page)).toBe(frozen)

  await sim.getByRole('button', { name: 'Resume' }).click()
  await sim.getByRole('button', { name: '4×' }).click()
  const fast = await counter(page)
  await page.waitForTimeout(2500)
  expect(await counter(page)).toBeGreaterThanOrEqual(fast + 6)

  await sim.getByRole('button', { name: 'Reset' }).click()
  await expect(sim.getByTestId('probe-counter')).toHaveText(/probe #6\d/)

  await scrollTo(page, 'evaluation')
  await expect(sim.getByTestId('sim-status')).toHaveText('Paused while off-screen')
})

test('missing data: the series loses measurements and can be toggled', async ({ page }) => {
  await open(page)
  await scrollTo(page, 'missing-data')
  const s = page.locator('#missing-data')
  await expect(s.getByTestId('lost-summary')).toHaveText(/\d+ of \d+ measurements are missing/, { timeout: 8000 })
  await s.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect(s.getByText('will be lost')).toBeVisible()
  await s.getByRole('button', { name: 'Incomplete', exact: true }).click()
  await expect(s.getByText('will be lost')).toHaveCount(0)
})

test('dataset: table, preprocessing, CSV validation and import', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page)
  await scrollTo(page, 'dataset')
  await expect(page.getByTestId('dataset-table').locator('tbody tr')).toHaveCount(48)
  await expect(page.getByTestId('rejected-rows').locator('tbody tr')).toHaveCount(4)
  await page.getByRole('tab', { name: 'Import CSV' }).click()
  await page.getByTestId('csv-input').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('timestamp,ping_ms\n0,10\n0,11\n2,12\n') })
  await expect(page.getByTestId('csv-errors')).toContainText('Line 3: Timestamp 0 duplicates line 2')
  await page.getByRole('button', { name: 'Load sample CSV' }).click()
  await expect(page.getByText('Imported: sample.csv')).toBeVisible()
  await expect(page.getByTestId('dataset-table').locator('tbody tr')).toHaveCount(10)
  await scrollTo(page, 'reconstruction')
  await expect(page.getByTestId('reconstruction-status')).toContainText('2 of 2 gaps estimated', { timeout: 10_000 })
  await scrollTo(page, 'evaluation')
  await expect(page.getByText(/known interior rows are held out/)).toBeVisible()
  expect(errors).toEqual([])
})

test('methods: switching methods rebuilds the curve with the real estimate', async ({ page }) => {
  await open(page)
  await scrollTo(page, 'methods')
  const s = page.locator('#methods')
  await expect(s.getByTestId('method-estimate')).toBeVisible({ timeout: 6000 })
  await expect(s.getByTestId('estimate-marker')).toBeVisible()
  const lagrange = await s.getByTestId('method-estimate').locator('p').nth(1).textContent()
  await s.getByRole('tab', { name: 'Newton divided differences' }).click()
  await expect(s.getByTestId('divided-differences')).toBeVisible()
  await expect(s.getByTestId('estimate-marker')).toBeVisible({ timeout: 6000 })
  expect(await s.getByTestId('method-estimate').locator('p').nth(1).textContent()).toBe(lagrange)
  await s.getByRole('tab', { name: 'Natural cubic spline' }).click()
  await expect(s.getByTestId('estimate-marker')).toBeVisible({ timeout: 6000 })
  await s.getByRole('button', { name: 'Replay construction' }).click()
  await expect(s.getByText('Constructing…')).toBeVisible()
})

test('reconstruction animates every gap into an amber estimate', async ({ page }) => {
  await open(page)
  await scrollTo(page, 'reconstruction')
  const s = page.locator('#reconstruction')
  await expect(s.getByTestId('reconstruction-status')).toContainText('Estimating', { timeout: 4000 })
  await expect(s.getByTestId('reconstruction-status')).toContainText('9 of 9 gaps estimated', { timeout: 12_000 })
  await expect(s.locator('[data-testid^="reconstructed-"]')).toHaveCount(9)
  await s.getByRole('button', { name: 'Original' }).click()
  await expect(s.locator('[data-testid^="reconstructed-"]')).toHaveCount(0)
})

test('evaluation compares all three methods and highlights the best', async ({ page }) => {
  await open(page)
  await scrollTo(page, 'evaluation')
  for (const m of ['lagrange', 'newton', 'spline']) await expect(page.getByTestId(`metrics-${m}`)).toContainText('RMSE')
  await expect(page.getByText('Lowest RMSE').first()).toBeVisible()
  await expect(page.getByTestId('comparison-bars')).toBeVisible()
  await expect(page.getByTestId('interpretation')).toContainText('does not validate')
})

test('charts show values on hover', async ({ page }) => {
  await open(page)
  await scrollTo(page, 'reconstruction')
  const chart = page.locator('#reconstruction svg[aria-label="The series with reconstructed values"]')
  await expect(chart).toBeVisible()
  const box = (await chart.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5)
  await expect(page.locator('#reconstruction').getByText(/t = [\d.]+ s/).first()).toBeVisible()
})

test('reduced motion: no ambient animation, finished results shown at once', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1366, height: 768 } })
  const page = await context.newPage()
  await open(page)
  await expect(page.getByText('Paused for reduced motion')).toBeVisible()
  await scrollTo(page, 'simulation')
  await expect(page.locator('#simulation').getByTestId('sim-status')).toHaveText('Paused')
  await scrollTo(page, 'methods')
  await expect(page.locator('#methods').getByTestId('estimate-marker')).toBeVisible()
  await context.close()
})

for (const viewport of [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`responsive at ${viewport.width}px: no horizontal overflow, every section reachable`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const errors = trackErrors(page)
    await open(page)
    for (const id of SECTIONS) {
      await scrollTo(page, id)
      await page.waitForTimeout(250)
    }
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    if (viewport.width < 1024) {
      await scrollTo(page, 'overview')
      await page.getByRole('button', { name: /Menu/ }).click()
      await page.locator('#mobile-nav').getByRole('link', { name: 'Evaluation' }).click()
      await expect(page.locator('#evaluation')).toBeInViewport()
    }
    await info.attach(`full-page-${viewport.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    expect(errors).toEqual([])
    await context.close()
  })
}
