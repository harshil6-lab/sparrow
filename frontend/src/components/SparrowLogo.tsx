import { SparrowMascot } from "./SparrowMascot";

export function SparrowLogo({ light = false }: { light?: boolean }) {
  return (
    <div className={`logo ${light ? "light" : ""}`.trim()}>
      <SparrowMascot size={48} />
      <span>Sparrow</span>
    </div>
  );
}
