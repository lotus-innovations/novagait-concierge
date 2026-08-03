import { expect, type Page } from "@playwright/test";

/** Bot messages inside the widget's shadow DOM (Playwright pierces it). */
export function botMessages(page: Page) {
  return page.locator(".msg-bot");
}

/** Send a message through the composer and wait for the next bot reply. */
export async function sendMessage(page: Page, text: string): Promise<void> {
  const before = await botMessages(page).count();
  await page.locator("#ngc-input").fill(text);
  await page.locator("button.send").click();
  await expect(botMessages(page)).toHaveCount(before + 1, { timeout: 10_000 });
}

/** id/class of the focused element inside the widget's shadow root. */
export async function shadowFocus(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const host = document.getElementById("novagait-concierge");
    const active = host?.shadowRoot?.activeElement;
    return active ? active.id || active.className : null;
  });
}
