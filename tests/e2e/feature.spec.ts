import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

const AXES = ["energy", "joy", "focus", "calm", "chaos"] as const;

async function setAllAxes(page: Page, key: "Home" | "End") {
  for (const axis of AXES) {
    const thumb = page.locator(`.vibe-row[data-axis="${axis}"] [role="slider"]`);
    await thumb.focus();
    await thumb.press(key);
  }
}

test("room averages AND each peer's gap match on BOTH screens", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    // alice = all 0 (Home = min on the Radix slider); bob = all 100 (End = max).
    await setAllAxes(a, "Home");
    await setAllAxes(b, "End");
    await b.waitForTimeout(700);

    // The advertised "room averages" must be identical on BOTH peers: with one
    // peer at 0 and one at 100, every axis averages to 50 — and that average is
    // a fold over the SHARED Yjs map, so it can only read 50 on both screens if
    // each peer's slider value actually crossed the mesh.
    for (const page of [a, b]) {
      for (const axis of AXES) {
        const v = await page.locator(`.vibe-avg[data-axis="${axis}"]`).getAttribute("data-value");
        const n = Number(v);
        if (!(n >= 48 && n <= 52)) throw new Error(`${axis} avg=${v} on a peer`);
      }
    }

    // The advertised "your gap" is per-peer: alice (you=0, room=50) → Δ-50,
    // bob (you=100, room=50) → Δ+50. Proving BOTH gaps proves the average is
    // computed from the same shared data on each side, not echoed locally.
    for (const axis of AXES) {
      await expect(a.locator(`.vibe-avg[data-axis="${axis}"] .vibe-gap`)).toContainText(
        "you: 0 · room: 50 (Δ-50)",
      );
      await expect(b.locator(`.vibe-avg[data-axis="${axis}"] .vibe-gap`)).toContainText(
        "you: 100 · room: 50 (Δ+50)",
      );
    }

    // Falsifiability: move ONE of bob's axes to the middle and confirm the
    // shared average shifts on BOTH screens (not a hard-coded 50). bob energy
    // 100 → 0 makes the room energy average 0, with alice already at 0.
    const bobEnergy = b.locator(`.vibe-row[data-axis="energy"] [role="slider"]`);
    await bobEnergy.focus();
    await bobEnergy.press("Home");
    await b.waitForTimeout(500);

    for (const page of [a, b]) {
      const v = await page.locator(`.vibe-avg[data-axis="energy"]`).getAttribute("data-value");
      const n = Number(v);
      if (!(n >= 0 && n <= 2)) throw new Error(`energy avg after move=${v} on a peer`);
    }
    // alice's energy gap is now you=0 room=0 → Δ0; bob's is you=0 room=0 → Δ0.
    await expect(a.locator(`.vibe-avg[data-axis="energy"] .vibe-gap`)).toContainText(
      "you: 0 · room: 0 (Δ+0)",
    );
    await expect(b.locator(`.vibe-avg[data-axis="energy"] .vibe-gap`)).toContainText(
      "you: 0 · room: 0 (Δ+0)",
    );
  } finally {
    await cleanup();
  }
});
