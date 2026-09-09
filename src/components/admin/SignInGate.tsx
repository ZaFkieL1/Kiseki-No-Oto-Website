import { useState } from "react";
import { ADMINS, signIn, signOutOfKernel, type Session } from "../../lib/auth";

/**
 * The door.
 *
 * Three states, and each one says what to do next rather than only what is
 * wrong: still asking Firebase, nobody signed in, or signed in as someone who
 * is not on the list. The last is the one that needs an exit, so it offers to
 * switch accounts instead of leaving you stuck.
 *
 * Nothing here is security. It decides what the console shows; the rules
 * decide what the database accepts.
 */
export default function SignInGate({
  session,
}: {
  session: Session;
}): React.ReactElement {
  const [problem, setProblem] = useState("");

  const attempt = async (): Promise<void> => {
    setProblem("");
    try {
      await signIn();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setProblem(
        code.includes("popup-closed-by-user") || code.includes("cancelled")
          ? "Sign-in window closed before it finished."
          : "Sign-in failed. Check the Google provider is enabled in the Firebase console."
      );
    }
  };

  if (session.pending) {
    return (
      <div className="gate">
        <span className="hud">Checking session…</span>
      </div>
    );
  }

  if (session.email === null) {
    return (
      <div className="gate">
        <span className="kern__mark">
          KISEKI_OS<em>·KERNEL</em>
        </span>
        <p className="gate__lede">The catalogue is edited from here.</p>
        <button className="playcta" onClick={() => void attempt()}>
          Sign in with Google
        </button>
        {problem && <p className="fld__error">{problem}</p>}
      </div>
    );
  }

  return (
    <div className="gate">
      <span className="kern__mark">
        KISEKI_OS<em>·KERNEL</em>
      </span>
      <p className="gate__lede">
        {session.email} cannot edit this catalogue.
      </p>
      <p className="fld__hint">
        {ADMINS.length === 1
          ? `The account with access is ${ADMINS[0]}.`
          : `Accounts with access: ${ADMINS.join(", ")}.`}
      </p>
      <button className="playcta" onClick={() => void signOutOfKernel()}>
        Use a different account
      </button>
    </div>
  );
}
