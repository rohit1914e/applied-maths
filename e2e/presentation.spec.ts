import { expect, test, type Page } from '@playwright/test'

const TITLES = [
  'Understanding Network Latency',
  'When Measurements Disappear',
  'Preparing the Measurements',
  'The Mathematics of Reconstruction',
  'Reconstructing Missing Measurements',
  'How Accurate Is Our Reconstruction?',
  'From Missing Data to Reconstructed Measurements',
]

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
  await expect(page.getByTestId('scene-1')).toBeVisible()
}

/** The live simulation's probe counter, e.g. "probe #63". */
async function probeCount(page: Page) {
  const text = await page.getByText(/^probe #\d+$/).textContent()
  return Number(text!.replace(/\D/g, ''))
}

test('the landing is a live network simulation, not a static title', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page)
  const first = await probeCount(page)
  await page.waitForTimeout(3200)
  expect(await probeCount(page)).toBeGreaterThanOrEqual(first + 2)
  // packets are moving: dot positions change between two moments
  const positions = () => page.locator('svg circle[fill="#c18b52"]').evaluateAll((els) => els.map((e) => `${e.getAttribute('cx')}:${e.getAttribute('opacity')}`).join('|'))
  const a = await positions()
  await page.waitForTimeout(300)
  expect(await positions()).not.toBe(a)
  await expect(page.getByTestId('live-trace')).toBeVisible()
  expect(errors).toEqual([])
})

test('the story never advances by itself', async ({ page }) => {
  await open(page)
  await page.waitForTimeout(6000)
  await expect(page.getByTestId('scene-1')).toHaveAttribute('aria-hidden', 'false')
  await expect(page.getByTestId('scene-2')).toHaveCount(0)
})

test('the mouse wheel moves through the story and cross-fades scenes', async ({ page }) => {
  await open(page)
  const stage = page.getByTestId('stage')
  await stage.hover()
  for (let i = 0; i < 40 && (await page.getByTestId('scene-2').count()) === 0; i++) await page.mouse.wheel(0, 300)
  await expect(page.getByTestId('scene-2')).toBeAttached()
  for (let i = 0; i < 30 && (await page.getByTestId('scene-1').count()) > 0; i++) await page.mouse.wheel(0, 200)
  await expect(page.getByTestId('scene-2')).toHaveAttribute('aria-hidden', 'false')
})

test('keyboard steps beats, jumps scenes and restarts', async ({ page }) => {
  await open(page)
  const step = page.getByTestId('next-step')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('caption-1')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByTestId('caption-2')).toBeVisible()
  await page.keyboard.press('ArrowUp')
  await expect(page.getByTestId('caption-1')).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('scene-2')).toHaveAttribute('aria-hidden', 'false')
  await page.keyboard.press('5')
  await expect(page.getByTestId('scene-5')).toHaveAttribute('aria-hidden', 'false', { timeout: 5000 })
  await page.keyboard.press('Home')
  await expect(page.getByTestId('scene-1')).toHaveAttribute('aria-hidden', 'false')
  await expect(step).toBeVisible()
})

test('every scene renders without errors, at 1920×1080', async ({ page }, info) => {
  const errors = trackErrors(page)
  await open(page)
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press(String(i + 1))
    const scene = page.getByTestId(`scene-${i + 1}`)
    await expect(scene).toHaveAttribute('aria-hidden', 'false', { timeout: 6000 })
    await expect(scene).toHaveAttribute('aria-label', TITLES[i])
    await page.waitForTimeout(500)
    await info.attach(`scene-${i + 1}`, { body: await page.getByTestId('stage').screenshot(), contentType: 'image/png' })
  }
  expect(errors).toEqual([])
})

test('pause freezes the simulation and resume continues it', async ({ page }) => {
  await open(page)
  await page.keyboard.press('p')
  await expect(page.getByRole('status').filter({ hasText: 'Animation paused' })).toBeVisible()
  const frozen = await probeCount(page)
  await page.waitForTimeout(2500)
  expect(await probeCount(page)).toBe(frozen)
  await page.getByRole('button', { name: 'Resume' }).click()
  await page.waitForTimeout(2500)
  expect(await probeCount(page)).toBeGreaterThan(frozen)
})

test('speed control changes the pace of the simulation', async ({ page }) => {
  await open(page)
  await page.getByLabel('Animation speed').selectOption('2')
  const start = await probeCount(page)
  await page.waitForTimeout(3000)
  expect(await probeCount(page)).toBeGreaterThanOrEqual(start + 5)
})

test('reduced motion stops ambient animation but keeps every scene usable', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Reduced motion' }).click()
  const still = await probeCount(page)
  await page.waitForTimeout(2000)
  expect(await probeCount(page)).toBe(still)
  await page.keyboard.press('4')
  await expect(page.getByTestId('scene-4')).toHaveAttribute('aria-hidden', 'false')
  // with reduced motion the step lands instantly on the finished construction
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('interp-estimate')).toBeVisible()
})

test('the interpolation scene builds each method from the real algorithms', async ({ page }) => {
  await open(page)
  await page.keyboard.press('4')
  await expect(page.getByTestId('scene-4')).toHaveAttribute('aria-hidden', 'false')
  await page.getByRole('tab', { name: 'Newton' }).click()
  await expect(page.getByRole('tab', { name: 'Newton' })).toHaveAttribute('aria-selected', 'true', { timeout: 5000 })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('divided-differences')).toBeVisible()
  await expect(page.getByTestId('interp-estimate')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('tab', { name: 'Compare' }).click()
  const table = page.getByTestId('compare-table')
  await expect(table).toBeVisible({ timeout: 5000 })
  const cells = await table.locator('td:nth-child(2)').allTextContents()
  expect(cells[0]).toBe(cells[1]) // Lagrange and Newton: the same polynomial
})

test('fullscreen shows only the stage; presenter notes stay off the projection', async ({ page }) => {
  await open(page)
  await page.keyboard.press('n')
  const notes = page.getByTestId('presenter-notes')
  await expect(notes).toBeVisible()
  const stage = (await page.getByTestId('stage').boundingBox())!
  const nb = (await notes.boundingBox())!
  expect(nb.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1)

  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-testid') ?? null)).toBe('presentation-root')
  expect(await page.evaluate(() => document.fullscreenElement!.querySelector('[data-testid="presenter-notes"]'))).toBeNull()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('scene-2')).toHaveAttribute('aria-hidden', 'false')
  await page.evaluate(() => document.exitFullscreen())
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
  await expect(page.getByTestId('presenter-notes')).toBeVisible()
})

test('presenter notes open in a separate window that follows the story', async ({ page }) => {
  await open(page)
  await page.keyboard.press('n')
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open in window' }).click()])
  await expect(popup.getByText('What to explain')).toBeVisible()
  await expect(popup.getByRole('heading', { name: TITLES[0] })).toBeVisible()
  await page.keyboard.press('ArrowRight')
  await expect(popup.getByRole('heading', { name: TITLES[1] })).toBeVisible()
  await popup.keyboard.press('ArrowRight')
  await expect(page.getByTestId('scene-3')).toHaveAttribute('aria-hidden', 'false')
})

test('changing the dataset flows through preparation, reconstruction and evaluation', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page)
  await page.keyboard.press('3')
  await expect(page.getByTestId('scene-3')).toHaveAttribute('aria-hidden', 'false')
  await page.getByRole('button', { name: 'Change dataset' }).click()
  await page.getByRole('tab', { name: 'Import CSV' }).click()
  await page.getByTestId('csv-input').setInputFiles({ name: 'bad.csv', mimeType: 'text/csv', buffer: Buffer.from('timestamp,ping_ms\n0,10\n0,11\n2,12\n') })
  await expect(page.getByTestId('csv-errors')).toContainText('Line 3: Timestamp 0 duplicates line 2')
  await page.getByRole('button', { name: 'Load sample CSV' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Loaded sample.csv' })).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()

  await page.keyboard.press('5')
  await expect(page.getByTestId('scene-5')).toHaveAttribute('aria-hidden', 'false')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('reconstruction-status')).toContainText('2 of 2 gaps estimated', { timeout: 15_000 })

  await page.keyboard.press('6')
  await expect(page.getByTestId('scene-6')).toHaveAttribute('aria-hidden', 'false')
  await expect(page.getByText(/known rows are held out/)).toBeVisible()
  expect(errors).toEqual([])
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`layout fits ${viewport.width}×${viewport.height} without horizontal scrolling`, async ({ browser }, info) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await open(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const stage = (await page.getByTestId('stage').boundingBox())!
    expect(stage.width).toBeLessThanOrEqual(viewport.width)
    expect(stage.x).toBeGreaterThanOrEqual(0)
    expect(Math.abs(stage.width / stage.height - 16 / 9)).toBeLessThan(0.01)
    const barOverflow = await page.getByTestId('control-bar').evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(barOverflow).toBeLessThanOrEqual(0)
    if (viewport.width === 1366) {
      for (let i = 0; i < 7; i++) {
        await page.keyboard.press(String(i + 1))
        await expect(page.getByTestId(`scene-${i + 1}`)).toHaveAttribute('aria-hidden', 'false', { timeout: 6000 })
        await page.waitForTimeout(400)
        await info.attach(`1366-scene-${i + 1}`, { body: await page.screenshot(), contentType: 'image/png' })
      }
    }
    await context.close()
  })
}
