import IdentityHero from "../system/IdentityHero";
import Manifest from "../system/Manifest";
import NameMeaning from "../system/NameMeaning";

/**
 * SYSTEM is the label, not the player.
 *
 * The hero carries identity and the current transmission side by side, so the
 * first screen says who the label is and what it is putting out at the same
 * time. Below it: the name, then what the label is for. The transport lives in
 * the dock and keeps running through all of it.
 */
export default function SystemView({
  onNavigate,
}: {
  onNavigate: (key: "releases") => void;
}): React.ReactElement {
  return (
    <div className="sys">
      <IdentityHero onExplore={() => onNavigate("releases")} />
      <NameMeaning />
      <Manifest />
    </div>
  );
}
