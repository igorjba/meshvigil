import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Keep the jsdom tree clean between component tests.
afterEach(() => {
  cleanup();
});
