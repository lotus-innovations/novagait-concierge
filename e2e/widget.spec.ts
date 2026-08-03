import { expect, test } from "@playwright/test";
import { botMessages, sendMessage, shadowFocus } from "./helpers";

/**
 * Floating widget on the landing page: launcher semantics, open/converse/
 * close by keyboard, focus trap while open, focus restore on close
 * (spec 01 §8).
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("button.launcher")).toBeVisible();
});

test("opens from the launcher, focuses the input, and chats", async ({
  page,
}) => {
  const launcher = page.locator("button.launcher");
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await launcher.click();
  await expect(page.locator("section.panel")).toBeVisible();
  await expect(botMessages(page).first()).toBeVisible(); // greeting
  expect(await shadowFocus(page)).toBe("ngc-input");

  await sendMessage(page, "How much does a visit cost without insurance?");
  await expect(botMessages(page).last()).toContainText(
    "Pricing & Self-Pay Rates",
  );
});

test("Escape closes the dialog and restores focus to the launcher", async ({
  page,
}) => {
  await page.locator("button.launcher").click();
  await expect(page.locator("section.panel")).toBeVisible();
  await expect(page.locator("button.launcher")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.locator("section.panel")).toBeHidden();
  const launcher = page.locator("button.launcher");
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  expect(await shadowFocus(page)).toContain("launcher");
});

test("Tab is trapped inside the open dialog", async ({ page }) => {
  await page.locator("button.launcher").click();
  expect(await shadowFocus(page)).toBe("ngc-input");

  // input -> send -> wraps to close (first focusable), never the host page.
  await page.keyboard.press("Tab");
  expect(await shadowFocus(page)).toContain("send");
  await page.keyboard.press("Tab");
  expect(await shadowFocus(page)).toContain("close");
  await page.keyboard.press("Shift+Tab");
  expect(await shadowFocus(page)).toContain("send");
});

test("close button returns focus to the launcher", async ({ page }) => {
  await page.locator("button.launcher").click();
  await page.locator("button.close").click();
  await expect(page.locator("section.panel")).toBeHidden();
  expect(await shadowFocus(page)).toContain("launcher");
});
