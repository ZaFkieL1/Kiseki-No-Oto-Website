import { useState } from "react";
import { signOutOfKernel } from "../../lib/auth";
import { useCatalogue } from "../../lib/hooks";
import ArtistsPanel from "./ArtistsPanel";
import EventsPanel from "./EventsPanel";
import ReleasesPanel from "./ReleasesPanel";
import SocialsPanel from "./SocialsPanel";
import SignInGate from "./SignInGate";
import { useSession } from "./useSession";

type SectionKey = "releases" | "artists" | "events" | "socials";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "releases", label: "Releases" },
  { key: "artists", label: "Artists" },
  { key: "events", label: "Events" },
  { key: "socials", label: "Social links" },
];

/**
 * The maintenance console. Not part of the public island — this page is the
 * only thing that mounts it, so none of this code reaches a visitor.
 *
 * Same chassis idea as `LabelOS`: a section key in state, no router. Denser and
 * plainer, because this one is a tool rather than a record sleeve.
 */
export default function AdminOS(): React.ReactElement {
  const [section, setSection] = useState<SectionKey>("releases");
  const { releases, artists, events, origin } = useCatalogue();
  const session = useSession();

  if (!session.authorised) return <SignInGate session={session} />;

  return (
    <div className="kern">
      <header className="kern__bar">
        <span className="kern__mark">
          KISEKI_OS<em>·KERNEL</em>
        </span>
        <span className="bar__spacer" />
        <span className="hud kern__origin">
          {/* Says which data you are looking at: the shipped seed while
              Firestore is still answering, the cloud once it has. */}
          {origin === "local" ? "Firestore" : "Seed (loading)"} ·{" "}
          {releases.length}/{artists.length}/{events.length}
        </span>
        <span className="hud kern__who">{session.email}</span>
        <button className="kern__reset" onClick={() => void signOutOfKernel()}>
          Sign out
        </button>
      </header>

      <div className="kern__body">
        <nav className="kern__rail" aria-label="Kernel">
          {SECTIONS.map((entry, index) => (
            <button
              key={entry.key}
              className="nav__item"
              aria-current={entry.key === section}
              onClick={() => setSection(entry.key)}
            >
              <span className="nav__num">
                {String(index + 1).padStart(2, "0")}
              </span>
              {entry.label}
            </button>
          ))}
        </nav>

        <main className="kern__work">
          {section === "releases" && <ReleasesPanel />}
          {section === "artists" && <ArtistsPanel />}
          {section === "events" && <EventsPanel />}
          {section === "socials" && <SocialsPanel />}
        </main>
      </div>
    </div>
  );
}
