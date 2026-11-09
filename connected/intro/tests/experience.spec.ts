import { test, expect } from '@playwright/test'

for (const reduced of [false, true]) {
  test(`white confession continuation (${reduced ? 'phone reduced motion' : 'desktop full motion'})`, async ({ page }) => {
    test.setTimeout(90000)
    if (reduced) await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/tests/confession-checks.html${reduced ? '?static' : ''}`)
    await page.getByRole('button', { name: 'Run confession checks' }).click()
    await expect(page.locator('#report')).toContainText('DONE', { timeout: 80000 })
    const report = await page.locator('#report').innerText()
    expect(report).not.toContain('FAIL')
    expect(report).toContain('PASS all six exact paragraphs')
    expect(report).toContain('PASS reverse scroll')
  })
}

test('official fluid, particles, scroll, resources, and performance checks pass', async ({ page }) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tests/browser-checks.html')
  await page.getByRole('button', { name: 'Run browser checks' }).click()
  await expect(page.locator('#report')).toContainText('DONE', { timeout: 110000 })
  const report = await page.locator('#report').innerText()
  console.log(report)
  expect(report).not.toContain('FAIL')
  expect(report).toContain('PASS all GPU resources')
  expect(errors).toEqual([])
})

test('reduced motion keeps accessible greeting without WebGL', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.loading')).toHaveCount(0)
  await expect(page.getByRole('heading')).toContainText('Heyyyyy')
  await expect(page.locator('[data-testid="splash-canvas"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Skip intro' }).click()
  await expect(page.locator('.white-paper')).toHaveCSS('opacity','1')
})

test('touch-only mobile has no GPU cursor and can reverse the sequence', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true,hasTouch:true,deviceScaleFactor:3 })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5188/')
  await expect(page.locator('.loading')).toHaveCount(0)
  await page.touchscreen.tap(200,420)
  await expect(page.locator('[data-testid="splash-canvas"]')).toHaveCount(0)
  await page.getByRole('button',{name:'Skip intro'}).tap()
  await expect(page.locator('.white-paper')).toHaveCSS('opacity','1')
  await page.evaluate(()=>scrollTo(0,0))
  await expect(page.locator('.sequence')).toHaveAttribute('data-frame','0')
  await context.close()
})


test('production motion control preserves dots and an explicit opt-in after reload', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.loading')).toHaveCount(0)
  const particles = page.locator('.particle-canvas')
  await expect(particles).toBeVisible()
  await expect(particles).toHaveAttribute('data-motion', 'static')
  await page.locator('.motion-toggle').click()
  await expect(particles).toHaveAttribute('data-motion', 'full')
  await expect(page.locator('[data-testid="splash-canvas"]')).toHaveCount(1)
  await page.reload()
  await expect(page.locator('.motion-toggle')).toContainText('Reduce motion')
  await expect(page.locator('[data-testid="splash-canvas"]')).toHaveCount(1)
  await page.locator('.motion-toggle').click()
  await expect(particles).toHaveAttribute('data-motion', 'static')
  await expect(page.locator('[data-testid="splash-canvas"]')).toHaveCount(0)
})
