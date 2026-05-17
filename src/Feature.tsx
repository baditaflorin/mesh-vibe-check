import { useEffect, useState } from "react";
import { useNamedPeer, type MeshConfig, type YRoom } from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };

type Vibe = { energy: number; joy: number; focus: number; calm: number; chaos: number; ts: number };

const AXES = [
  { key: "energy", label: "energy" },
  { key: "joy", label: "joy" },
  { key: "focus", label: "focus" },
  { key: "calm", label: "calm" },
  { key: "chaos", label: "chaos" },
] as const;

type AxisKey = (typeof AXES)[number]["key"];

const ZERO: Vibe = { energy: 0, joy: 0, focus: 0, calm: 0, chaos: 0, ts: 0 };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="vibe-screen">
        <h1>vibe check</h1>
        <p className="vibe-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, nameOf } = useNamedPeer(config, room);
  const [, bump] = useState(0);
  const vibes = room.doc.getMap<Vibe>("vibes");

  useEffect(() => {
    const cb = () => bump((n) => n + 1);
    vibes.observe(cb);
    return () => vibes.unobserve(cb);
  }, [vibes]);

  const trimmed = name.trim();
  useEffect(() => {
    if (!trimmed || vibes.get(room.peerId)) return;
    room.doc.transact(() => vibes.set(room.peerId, { ...ZERO, ts: Date.now() }));
  }, [trimmed, room, vibes]);

  const mine: Vibe = vibes.get(room.peerId) ?? ZERO;

  const writeAxis = (axis: AxisKey, value: number) => {
    const next: Vibe = { ...(vibes.get(room.peerId) ?? ZERO), [axis]: value, ts: Date.now() };
    room.doc.transact(() => vibes.set(room.peerId, next));
  };

  const reset = () => room.doc.transact(() => vibes.set(room.peerId, { ...ZERO, ts: Date.now() }));

  const all: Vibe[] = [];
  vibes.forEach((v) => v && typeof v === "object" && all.push(v));
  const avgOf = (axis: AxisKey) =>
    all.length === 0 ? 0 : all.reduce((s, v) => s + (Number(v[axis]) || 0), 0) / all.length;

  const present = room.peerCount + 1;

  return (
    <div className="vibe-screen">
      <header className="vibe-header">
        <h1>vibe check</h1>
        <p className="vibe-status">
          {all.length} reporting · {present} {present === 1 ? "peer" : "peers"}
        </p>
      </header>

      <div className="vibe-name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="your name"
          maxLength={48}
          aria-label="your name"
        />
      </div>

      <div className="vibe-sliders" role="group" aria-label="your vibe">
        {AXES.map(({ key, label }) => (
          <div key={key} className="vibe-row" data-axis={key}>
            <span className="vibe-rowlabel">{label}</span>
            <input
              className="vibe-slider"
              data-axis={key}
              type="range"
              min={0}
              max={100}
              value={mine[key]}
              onChange={(e) => writeAxis(key, Number(e.target.value))}
              aria-label={`${label} slider`}
            />
            <span className="vibe-mychip">{Math.round(mine[key])}</span>
          </div>
        ))}
      </div>

      <button type="button" className="vibe-reset" aria-label="reset" onClick={reset}>
        reset
      </button>

      <div className="vibe-avgs">
        {AXES.map(({ key, label }) => {
          const avg = avgOf(key);
          const you = mine[key];
          const delta = Math.round(you - avg);
          return (
            <div key={key} className="vibe-avg" data-axis={key} data-value={avg.toFixed(2)}>
              <div className="vibe-avglabel">{label}</div>
              <div className="vibe-bar">
                <div className="vibe-barfill" style={{ width: `${avg}%` }} />
                <div className="vibe-dot" style={{ left: `${you}%` }} />
              </div>
              <div className="vibe-gap">
                you: {Math.round(you)} · room: {Math.round(avg)} (Δ
                {delta >= 0 ? `+${delta}` : delta})
              </div>
            </div>
          );
        })}
      </div>

      <div className="vibe-strip" aria-label="peers">
        {Array.from(vibes.entries()).map(([pid, v]) => (
          <div key={pid} className="vibe-swatch" title={nameOf(pid) ?? pid.slice(0, 6)}>
            <div className="vibe-swatchname">{nameOf(pid) ?? pid.slice(0, 6)}</div>
            <div className="vibe-swatchbars">
              {AXES.map(({ key }) => (
                <div
                  key={key}
                  className="vibe-swatchbar"
                  style={{ height: `${Number(v[key]) || 0}%` }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
