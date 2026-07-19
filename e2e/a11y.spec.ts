import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("console has no WCAG 2.1 A/AA violations", async ({ page }) => {
  // The scan waits for the worker to produce telemetry; give the whole flow room,
  // since a cold dev server compiles the page on the first request.
  test.setTimeout(90_000);

  await page.goto("/");

  // Wait for the client-side engine to render telemetry so the full UI — tables,
  // panels, the DLMS inspector — is present before scanning.
  await expect(page.getByRole("cell", { name: /^MTR-\d+$/ }).first()).toBeVisible({ timeout: 60_000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});
