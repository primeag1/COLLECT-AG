import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
  '/',
  '/privacy',
  '/terms',
  '/onboarding',
  '/app/dashboard',
  '/app/students',
  '/app/batches',
  '/app/subjects',
  '/app/payments',
  '/app/receipts',
  '/app/reports',
  '/app/settings',
];

for (const width of [360, 1280]) {
  for (const route of routes) {
    test(`${route || '/'} is free of serious and critical accessibility issues at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((completeOnboarding: boolean) => {
        localStorage.setItem('fl_user', JSON.stringify({
          id: 'axe-user',
          email: 'axe@example.test',
          displayName: 'Axe Test',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        const request = indexedDB.open('FeeLedgerDB', 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          const settings = db.createObjectStore('settings', { keyPath: 'id' });
          settings.put({
            id: 'singleton',
            schemaVersion: 1,
            onboardingComplete: completeOnboarding,
            defaultCurrency: 'INR',
            business: { businessName: 'Axe Test Academy' },
            receiptNumbering: {
              prefix: 'CAG', includeYear: true, includeMonth: true,
              startingNumber: 1, padding: 4, nextNumber: 1,
            },
            paymentModes: [{ id: 'cash', label: 'Cash', enabled: true, order: 0 }],
          });
        };
      }, route !== '/onboarding');

      await page.route('https://www.googleapis.com/**', async request => {
        const method = request.request().method();
        if (method === 'POST' && request.request().url().includes('/drive/v3/files')) {
          const metadata = request.request().postDataJSON() as { name?: string };
          await request.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: `axe-${metadata.name ?? 'file'}`,
              name: metadata.name ?? 'file',
              mimeType: 'application/vnd.google-apps.folder',
            }),
          });
          return;
        }
        await request.fulfill({ status: 200, contentType: 'application/json', body: '{"files":[]}' });
      });

      await page.goto(route.replace(/^\//, ''));
      await expect(page.locator('body')).not.toBeEmpty();
      await page.waitForTimeout(500);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const serious = results.violations.filter(issue =>
        issue.impact === 'serious' || issue.impact === 'critical'
      );
      expect(serious, serious.map(issue => `${issue.id}: ${issue.help}`).join('\n')).toEqual([]);
      const undersizedTargets = await page.locator('button, input, select, textarea, [role="switch"]')
        .evaluateAll(elements => elements
          .filter(element => element.getClientRects().length > 0)
          .map(element => ({
            element: element.tagName.toLowerCase(),
            width: element.getBoundingClientRect().width,
            height: element.getBoundingClientRect().height,
            label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
          }))
          .filter(({ width, height }) => width < 44 || height < 44));
      expect(undersizedTargets, JSON.stringify(undersizedTargets)).toEqual([]);
    });
  }
}
