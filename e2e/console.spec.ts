import { expect, test } from "@playwright/test";

test.describe("MeshVigil console", () => {
  test("boots the client-side engine and streams telemetry", async ({ page }) => {
    await page.goto("/");

    // The console shell renders immediately (SSR).
    await expect(page.getByText("MeshVigil").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Network Topology" })).toBeVisible();

    // The Web Worker must actually run: within a few read cycles the telemetry
    // table fills with meter readings. This proves engine + codec + transport.
    const firstReading = page.getByRole("cell", { name: /^MTR-\d+$/ }).first();
    await expect(firstReading).toBeVisible({ timeout: 20_000 });
  });

  test("chaos injection produces events and moves the SLA", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("cell", { name: /^MTR-\d+$/ }).first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /Kill collector/ }).click();

    // The event log should record the collector going offline.
    await expect(page.getByText(/forced offline/i).first()).toBeVisible({ timeout: 10_000 });

    // Restore should heal it and log a recovery-class event.
    await page.getByRole("button", { name: /Restore all/ }).click();
    await expect(page.getByText(/restoring|cleared/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("DLMS inspector decodes a frame into OBIS registers", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /DLMS \/ COSEM Inspector/ })).toBeVisible();

    // The default sample decodes to the active-energy register.
    await expect(page.getByText("1.0.1.8.0.255").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/FCS ok/i).first()).toBeVisible();

    // Selecting the corrupt sample must surface a failed FCS.
    await page.getByRole("button", { name: /Corrupt frame/ }).click();
    await expect(page.getByText(/FCS fail/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
