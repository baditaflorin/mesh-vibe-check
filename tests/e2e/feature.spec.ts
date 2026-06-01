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

    // Wait for both peers to see each other before reading shared averages: the
    // "N reporting" status only reaches 2 once both vibe entries have crossed
    // the mesh (web-first, no fixed sleep).
    await expect(a.locator(".vibe-status")).toContainText("2 reporting");
    await expect(b.locator(".vibe-status")).toContainText("2 reporting");

    // alice = all 0 (Home = min on the Radix slider); bob = all 100 (End = max).
    await setAllAxes(a, "Home");
    await setAllAxes(b, "End");

    // The advertised "your gap" is per-peer: alice (you=0, room=50) → Δ-50,
    // bob (you=100, room=50) → Δ+50. These web-first assertions poll until each
    // slider value has crossed the mesh; proving BOTH gaps proves the average is
    // a fold over the SHARED Yjs map on each side, not echoed locally. (The
    // data-value check below then pins the exact shared average on both peers.)
    for (const axis of AXES) {
      await expect(a.locator(`.vibe-avg[data-axis="${axis}"] .vibe-gap`)).toContainText(
        "you: 0 · room: 50 (Δ-50)",
      );
      await expect(b.locator(`.vibe-avg[data-axis="${axis}"] .vibe-gap`)).toContainText(
        "you: 100 · room: 50 (Δ+50)",
      );
    }

    // The advertised "room averages" must be identical on BOTH peers: with one
    // peer at 0 and one at 100, every axis averages to 50.
    for (const page of [a, b]) {
      for (const axis of AXES) {
        const v = await page.locator(`.vibe-avg[data-axis="${axis}"]`).getAttribute("data-value");
        const n = Number(v);
        if (!(n >= 48 && n <= 52)) throw new Error(`${axis} avg=${v} on a peer`);
      }
    }

    // Falsifiability: move ONE of bob's axes to the middle and confirm the
    // shared average shifts on BOTH screens (not a hard-coded 50). bob energy
    // 100 → 0 makes the room energy average 0, with alice already at 0.
    const bobEnergy = b.locator(`.vibe-row[data-axis="energy"] [role="slider"]`);
    await bobEnergy.focus();
    await bobEnergy.press("Home");

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
