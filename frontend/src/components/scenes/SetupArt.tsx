import { Icon } from "../Icon";
import { SparrowMascot, type SparrowPose } from "../SparrowMascot";

/**
 * The setup scene that visibly builds up as the user answers each step:
 * step 0 bare plot → step 4 complete picture (bill sky).
 * Reused from the Figma Make export.
 */
export function SetupArt({
  step,
  home,
  people,
  lines,
}: {
  step: number;
  home?: string | null;
  people?: string | null;
  lines: string[];
}) {
  const count = people?.includes("5") ? 5 : people?.includes("3") ? 4 : people?.includes("2") ? 2 : 1;
  const homeKey = home?.includes("Apartment") || home === "apartment"
    ? "apartment"
    : home?.includes("Row") || home === "row"
      ? "row"
      : "house";
  const pose: SparrowPose = step === 0 ? "curious" : step === 4 ? "celebrate" : "hop";
  return (
    <div className={`setup-art build-${step}`}>
      <div className="build-sky">
        {step === 4 && <><Icon name="bill" size={30} /><span>YOUR BILL SKY</span></>}
      </div>
      <div className="bare-plot" />
      <div className={`building ${homeKey}`} />
      {step >= 2 && <div className="build-people">{Array.from({ length: count }).map((_, i) => <i key={i} />)}</div>}
      {step >= 3 && <div className="city-silhouette"><i /><i /><i /><i /></div>}
      <div className="build-persona">
        <div className="art-speech">{lines[step]}</div>
        <SparrowMascot pose={pose} size={78} />
      </div>
    </div>
  );
}
