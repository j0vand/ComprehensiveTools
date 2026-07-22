const { expect, test } = require('@playwright/test');

const baseURL = process.env.SITE_BASE_URL || 'http://127.0.0.1:8000';
if (process.env.PLAYWRIGHT_CHANNEL) {
    test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });
}

const pages = [
    ['首页', '/index.html', '.tools-grid'],
    ['养老金计算', '/pages/pension-calculator/pensionCalculator.html', '.calculator-layout'],
    ['FIRE 退休规划', '/pages/retirement-calculator/retirementCalculator.html', '.calculator-layout'],
    ['个税计算', '/pages/tax/taxCalculator.html', '.container'],
    ['理财计算', '/pages/finance/financeCalculator.html', '.calculator-types'],
    ['房贷计算', '/pages/mortgage/mortgageCalculator.html', '.calculator-container'],
    ['膳食计划', '/pages/meal/mealViewer.html', '#todayMeals'],
    ['库存管理', '/pages/inventory/inventoryManager.html', '.main-content'],
    ['康复训练', '/pages/rehab-trainer/rehabTrainer.html', '#mainView'],
    ['出行清单', '/pages/travel-checklist/travelChecklist.html', '#checklist-wrapper']
];

for (const [viewportName, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }]
]) {
    test.describe(viewportName, () => {
        test.use({ viewport });

        for (const [name, pathname, readySelector] of pages) {
            test(`${name} loads without runtime errors`, async ({ page }) => {
                const errors = [];
                page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
                page.on('console', message => {
                    if (message.type() === 'error') {
                        const location = message.location().url;
                        errors.push(`console: ${message.text()}${location ? ` (${location})` : ''}`);
                    }
                });
                page.on('response', response => {
                    if (response.status() >= 400) {
                        errors.push(`response: ${response.status()} ${response.url()}`);
                    }
                });

                const response = await page.goto(`${baseURL}${pathname}`, { waitUntil: 'load' });
                expect(response?.ok(), `HTTP failure for ${pathname}`).toBe(true);
                await expect(page.locator(readySelector).first()).toBeVisible();
                await page.waitForTimeout(300);

                const layout = await page.evaluate(() => ({
                    bodyText: document.body.innerText.trim(),
                    viewportWidth: document.documentElement.clientWidth,
                    contentWidth: document.documentElement.scrollWidth
                }));
                expect(layout.bodyText.length).toBeGreaterThan(20);
                expect(layout.contentWidth, `horizontal overflow on ${pathname}`).toBeLessThanOrEqual(layout.viewportWidth + 1);
                expect(errors).toEqual([]);
            });
        }
    });
}
