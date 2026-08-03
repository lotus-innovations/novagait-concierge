import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Spec 01 §8 acceptance: axe reports 0 WCAG A/AA violations on all three
 * surfaces — the page hosting the open floating widget, the standalone
 * chat page, and every admin view. axe-core scans open shadow roots, so
 * the widget internals are covered.
 */

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function expectNoViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("landing page with the floating widget open", async ({ page }) => {
  await page.goto("/");
  await expectNoViolations(page); // closed state first
  await page.locator("button.launcher").click();
  await expect(page.locator("section.panel")).toBeVisible();
  await expectNoViolations(page);
});

test("standalone chat page with a conversation", async ({ page }) => {
  await page.goto("/chat");
  await page.locator("#ngc-input").fill("Do you take Medicare?");
  await page.locator("button.send").click();
  await expect(page.locator(".msg-bot")).toHaveCount(2);
  await expectNoViolations(page);
});

for (const path of [
  "/admin",
  "/admin/conversations",
  "/admin/frontdesk",
  "/admin/bookings",
  "/admin/automation",
]) {
  test(`admin view ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoViolations(page);
  });
}
