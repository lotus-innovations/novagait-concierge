import { expect, test } from "@playwright/test";
import { botMessages, sendMessage } from "./helpers";

/**
 * Scripted conversation on the standalone /chat page against the mock
 * backend: grounded answer with a citation, booking through the real
 * executor + automation chain, handoff, and the out-of-scope decline.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/chat");
  await expect(botMessages(page)).toHaveCount(1); // greeting
});

test("answers a KB question with a source citation", async ({ page }) => {
  await sendMessage(page, "Do you take Medicare?");
  const reply = botMessages(page).last();
  await expect(reply).toContainText("Insurance FAQ");
  await expect(reply.locator(".sources")).toContainText("From: Insurance FAQ");
});

test("declines an out-of-scope question", async ({ page }) => {
  await sendMessage(page, "zqxwv flurbonium kryptonite");
  await expect(botMessages(page).last()).toContainText(
    "don't have information",
  );
});

test("books an appointment and returns a reference code", async ({ page }) => {
  await sendMessage(page, "I'd like to book an appointment");
  await expect(botMessages(page).last()).toContainText(/NG-\d{4}/);
});

test("hands off to a human with a visible notice", async ({ page }) => {
  await sendMessage(page, "Can I talk to a human please?");
  await expect(botMessages(page).last()).toContainText("front desk");
  await expect(page.locator(".notice").last()).toContainText(
    "shared with the front desk team",
  );
});

test("session cap ends the conversation with the walkthrough CTA", async ({
  page,
}) => {
  test.setTimeout(120_000);
  for (let i = 1; i <= 15; i += 1) {
    await sendMessage(page, `question ${i}: what are your hours?`);
  }
  // Message 16 crosses the cap: CTA notice + disabled composer.
  await sendMessage(page, "one more question");
  await expect(page.locator(".notice").last()).toContainText(
    "Demo conversation complete",
  );
  await expect(
    page.locator(".notice a[href='https://lotusinnovations.io/#contact']"),
  ).toBeVisible();
  await expect(page.locator("#ngc-input")).toBeDisabled();
  await expect(page.locator("button.send")).toBeDisabled();
});
