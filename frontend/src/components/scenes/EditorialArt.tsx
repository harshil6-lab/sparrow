import { SparrowMascot, type SparrowPose } from "../SparrowMascot";

export type ArtKind =
  | "dawn-wire"
  | "panorama"
  | "doorway"
  | "courtyard"
  | "ac-haze"
  | "empty-lights"
  | "empty-wire"
  | "family-off"
  | "ready"
  | "solar-roof"
  | "evening";

/**
 * Editorial illustration used across the welcome, login, story, ready and app
 * screens. Structure reused verbatim from the Figma Make export; the visuals
 * are pure CSS shapes defined in the stylesheet.
 */
export function EditorialArt({
  kind,
  pose = "curious",
  line,
}: {
  kind: ArtKind;
  pose?: SparrowPose;
  line?: string;
}) {
  return (
    <div className={`editorial-art art-${kind}`}>
      <div className="art-sun" />
      <div className="art-ground" />
      {(kind === "panorama" || kind === "doorway") && (
        <><div className="art-house h1" /><div className="art-house h2" /><div className="art-tree" /><div className="art-tank" /><div className="art-clothes" /></>
      )}
      {kind === "dawn-wire" && <div className="solo-wire" />}
      {kind === "courtyard" && (
        <><div className="courtyard-wall"><i /><i /><i /></div><div className="courtyard-tree" /><div className="charpai" /><div className="chai"><i /><i /></div><div className="family-silhouette"><i /><i /><i /></div></>
      )}
      {kind === "ac-haze" && (
        <><div className="hot-home" /><div className="ac-unit a1"><i /></div><div className="ac-unit a2"><i /></div><div className="heat-lines" /></>
      )}
      {kind === "empty-lights" && <><div className="empty-room"><i /><i /></div><div className="lit-window" /></>}
      {kind === "empty-wire" && <><div className="story-wire" /><div className="child-looking"><i /></div></>}
      {kind === "family-off" && <><div className="family-home"><i /><b /></div><div className="switch-hand" /><div className="windowsill" /></>}
      {kind === "ready" && <><div className="ready-home-art" /><div className="ready-leaf l1" /><div className="ready-leaf l2" /></>}
      {kind === "solar-roof" && <><div className="sun-rays" /><div className="solar-house"><i /><i /><i /></div></>}
      {kind === "evening" && <><div className="evening-home"><i /><i /></div><div className="evening-moon" /><div className="evening-plant" /></>}
      {kind !== "empty-wire" && (
        <div className="art-sparrow">
          <SparrowMascot pose={pose} size={kind === "dawn-wire" ? 105 : 92} />
          {line ? <div className="art-speech">{line}</div> : null}
        </div>
      )}
    </div>
  );
}
