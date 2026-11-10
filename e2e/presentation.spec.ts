import { expect, test, type Page } from '@playwright/test'

const TITLES = [
  'Understanding Network Latency',
  'The Journey of a Network Packet',
  'When Measurements Disappear',
  'Preparing the Measurements',
  'The Mathematics Behind Reconstruction',
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
  await expect(page.getByTestId('chapter-1')).toBeVisible()
}

test('all eight chapters render on a 16:9 stage without errors', async ({ page }, info) => {
  const errors = trackErrors(page)
  await open(page)
  for (let i = 0; i < 8; i++) {
    if (i > 0) await page.keyboard.press('ArrowRight')
    const chapter = page.getByTestId(`chapter-${i + 1}`)
    await expect(chapter).toBeVisible()
    await expect(chapter).toHaveAttribute('aria-label', TITLES[i])
    const box = (await page.getByTestId('stage').boundingBox())!
    expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.01)
    await page.waitForTimeout(400)
    await info.attach(`chapter-${i + 1}`, { body: await page.getByTestId('stage').screenshot(), contentType: 'image/png' })
  }
  expect(errors).toEqual([])
})

test('the presentation never advances on its own', async ({ page }) => {
  await open(page)
  await page.waitForTimeout(6000)
  await expect(page.getByTestId('chapter-1')).toBeVisible()
  await expect(page.getByTestId('chapter-2')).toHaveCount(0)
})

test('keyboard: Space walks the builds, arrows and clicker keys change chapter, digits jump', async ({ page }) => {
  await open(page)
  const build = page.getByTestId('next-build')
  await expect(build).toContainText('0/3')
  await page.keyboard.press('Space')
  await expect(build).toContainText('1/3')
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('chapter-2')).toBeVisible()
  await page.keyboard.press('PageDown')
  await expect(page.getByTestId('chapter-3')).toBeVisible()
  await page.keyboard.press('PageUp')
  await expect(page.getByTestId('chapter-2')).toBeVisible()
  await page.keyboard.press('6')
  await expect(page.getByTestId('chapter-6')).toBeVisible()
  await page.keyboard.press('Home')
  await expect(page.getByTestId('chapter-1')).toBeVisible()
})

test('fullscreen shows only the stage; notes stay off the projected output', async ({ page }) => {
  await open(page)
  await page.keyboard.press('n')
  const notes = page.getByTestId('presenter-notes')
  await expect(notes).toBeVisible()

  // notes never overlap the stage
  const stage = (await page.getByTestId('stage').boundingBox())!
  const nb = (await notes.boundingBox())!
  expect(nb.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1)

  await page.getByRole('button', { name: 'Fullscreen' }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.getAttribute('data-testid') ?? null)).toBe('presentation-root')
  expect(await page.evaluate(() => document.fullscreenElement!.querySelector('[data-testid="presenter-notes"]'))).toBeNull()
  await expect(notes).toBeHidden()

  await page.keyboard.press('ArrowRight')
  await expect(page.getByTestId('chapter-2')).toBeVisible()
  await page.evaluate(() => document.exitFullscreen())
  await expect.poll(() => page.evaluate(() => document.fullscreenElement)).toBeNull()
  await expect(page.getByTestId('presenter-notes')).toBeVisible()
})

test('chapter 2 sends a ping and records a round-trip time', async ({ page }) => {
  await open(page)
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Send ping', exact: true }).click()
  await expect(page.getByText(/Reply received after \d+\.\d\d ms/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('hop-table')).toBeVisible()
  await page.getByRole('button', { name: 'Send ping that times out' }).click()
  await expect(page.getByText('Timed out: no value recorded')).toBeVisible({ timeout: 15_000 })
})

test('pause freezes a running demonstration and resume completes it', async ({ page }) => {
  await open(page)
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Send ping', exact: true }).click()
  await page.waitForTimeout(500)
  await page.keyboard.press('p')
  const frozen = await page.getByTestId('rtt-readout').textContent()
  await page.waitForTimeout(1200)
  expect(await page.getByTestId('rtt-readout').textContent()).toBe(frozen)
  await page.keyboard.press('p')
  await expect(page.getByText(/Reply received after/)).toBeVisible({ timeout: 15_000 })
})

test('data flows from CSV import through reconstruction to evaluation', async ({ page }) => {
  const errors = trackErrors(page)
  await open(page)
  await page.keyboard.press('4')
  await page.getByRole('tab', { name: 'Import CSV' }).click()
  await page.getByTestId('csv-input').setInputFiles({
    name: 'bad.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('timestamp,ping_ms\n0,10\n0,11\n2,12\n'),
  })
  await expect(page.getByTestId('csv-errors')).toContainText('Line 3: Timestamp 0 duplicates line 2')
  await page.getByRole('button', { name: 'Load sample CSV' }).click()
  await expect(page.getByTestId('dataset-label')).toContainText('sample.csv')

  await page.keyboard.press('6')
  await page.getByRole('button', { name: 'Newton' }).click()
  await page.getByRole('button', { name: 'Reconstruct', exact: true }).click()
  await expect(page.getByTestId('reconstructed-value')).toHaveText(/\d+\.\d\d ms/)
  await expect(page.getByTestId('intermediate-steps')).toContainText('Nested evaluation')

  await page.keyboard.press('7')
  await page.keyboard.press('Space')
  await page.keyboard.press('Space')
  await expect(page.getByTestId('metrics-spline')).toBeVisible()
  await expect(page.getByText(/hold out \d+ known rows/)).toBeVisible()
  expect(errors).toEqual([])
})

test('reduced motion shows final states immediately', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  await open(page)
  await page.keyboard.press('2')
  await page.getByRole('button', { name: 'Send ping', exact: true }).click()
  await expect(page.getByText(/Reply received after/)).toBeVisible({ timeout: 1000 })
  await context.close()
})

for (const viewport of [
  { width: 1366, height: 768 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`layout fits a ${viewport.width}×${viewport.height} screen without horizontal scrolling`, async ({ browser }) => {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await open(page)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const stage = (await page.getByTestId('stage').boundingBox())!
    expect(stage.width).toBeLessThanOrEqual(viewport.width)
    expect(stage.x).toBeGreaterThanOrEqual(0)
    const bar = page.getByTestId('control-bar')
    const barOverflow = await bar.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(barOverflow).toBeLessThanOrEqual(0)
    await context.close()
  })
}
