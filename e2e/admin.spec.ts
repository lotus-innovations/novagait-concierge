import { expect, test } from "@playwright/test";

/**
 * Admin views over data created through the public chat endpoint (mock
 * backend, real executors): booking appears in Bookings/CRM + Automation,
 * handoff appears in the Front Desk queue, transcript is browsable.
 */

const SEED_SESSION = "e2e-admin-seed-0001";

test.beforeAll(async ({ request }) => {
  for (const message of [
    "Do you take Medicare?",
    "I'd like to book an appointment",
    "Can I talk to a human please?",
  ]) {
    const res = await request.post("/api/chat", {
      data: { sessionId: SEED_SESSION, message },
    });
    expect(res.ok()).toBeTruthy();
  }
});

test("overview shows containment status and cost meter", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.locator("h1")).toHaveText("Overview");
  await expect(
    page.locator("h2", { hasText: "Containment status" }),
  ).toBeVisible();
  await expect(page.locator("h2", { hasText: "Cost by day" })).toBeVisible();
});

test("conversations list the seeded session with its transcript", async ({
  page,
}) => {
  await page.goto("/admin/conversations");
  await expect(page.locator("h1")).toHaveText("Conversations");
  const link = page.locator(`a[href*="${SEED_SESSION}"]`).first();
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.locator("h1")).toContainText(SEED_SESSION);
  await expect(page.locator("body")).toContainText("Do you take Medicare?");
});

test("front desk queue holds the handoff with a summary", async ({ page }) => {
  await page.goto("/admin/frontdesk");
  await expect(page.locator("h1")).toHaveText("Front Desk queue");
  await expect(
    page.locator(`a[href*="${SEED_SESSION}"]`).first(),
  ).toBeVisible();
  await expect(page.locator("body")).toContainText("asked to speak");
});

test("bookings, CRM, and invoice drafts show the seeded booking", async ({
  page,
}) => {
  await page.goto("/admin/bookings");
  await expect(page.locator("h1")).toContainText("Bookings");
  await expect(page.locator("body")).toContainText(/NG-\d{4}/);
  await expect(page.locator("h2", { hasText: "CRM" })).toBeVisible();
  await expect(page.locator("h2", { hasText: "Invoice drafts" })).toBeVisible();
});

test("automation view shows the chain for the seeded booking", async ({
  page,
}) => {
  await page.goto("/admin/automation");
  await expect(page.locator("h1")).toHaveText("Automation");
  await expect(
    page.locator("h2", { hasText: /Booking NG-\d{4}/ }).first(),
  ).toBeVisible();
  await expect(
    page.locator("h2", { hasText: "Notifications feed" }),
  ).toBeVisible();
});

test("admin is refused without credentials", async ({ browser }) => {
  const context = await browser.newContext({ httpCredentials: undefined });
  const page = await context.newPage();
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(401);
  await context.close();
});
