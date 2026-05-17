import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-vibe-check",
  description: "Five-axis vibe sliders → room averages + your gap.",
  accentHex: "#50d2c0",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
