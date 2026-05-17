import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("two peers' sliders average correctly on the other peer", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    // alice sets energy=0 joy=0 focus=0 calm=0 chaos=0
    for (const axis of ["energy", "joy", "focus", "calm", "chaos"]) {
      await a.locator(`.vibe-slider[data-axis="${axis}"]`).fill("0");
    }
    // bob sets all = 100
    for (const axis of ["energy", "joy", "focus", "calm", "chaos"]) {
      await b.locator(`.vibe-slider[data-axis="${axis}"]`).fill("100");
    }
    await b.waitForTimeout(700);

    // on bob's page the room avg should be ~50 on each axis
    for (const axis of ["energy", "joy", "focus", "calm", "chaos"]) {
      const v = await b.locator(`.vibe-avg[data-axis="${axis}"]`).getAttribute("data-value");
      const n = Number(v);
      if (!(n >= 48 && n <= 52)) throw new Error(`${axis} avg=${v}`);
    }
    expect(true).toBe(true);
  } finally {
    await cleanup();
  }
});
