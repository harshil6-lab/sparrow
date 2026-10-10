import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { SparrowLogo } from "../components/SparrowLogo";
import { LoginScene } from "../components/scenes/Scenes";
import { useAuth } from "../lib/AuthProvider";
import { nextRoute } from "../lib/types";

/**
 * Login. Email and "Continue with Google" both route through the same mock
 * auth provider. Cognito is a clearly marked stub (see src/lib/api/cognito.ts).
 * There is NO phone/OTP path.
 */
export function LoginScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitEmail = async () => {
    if (!email.includes("@")) {
      setError(t("login.emailError"));
      return;
    }
    setBusy(true);
    const profile = await signInWithEmail(email);
    setBusy(false);
    navigate(nextRoute(profile), { replace: true });
  };

  const submitGoogle = async () => {
    setBusy(true);
    const profile = await signInWithGoogle();
    setBusy(false);
    navigate(nextRoute(profile), { replace: true });
  };

  return (
    <main className="auth-screen">
      <aside>
        <LoginScene />
      </aside>
      <section className="auth-panel">
        <div className="auth-top">
          <button type="button" onClick={() => navigate("/welcome")}>← {t("login.back")}</button>
        </div>
        <SparrowLogo />
        <div className="eyebrow">{t("login.eyebrow")}</div>
        <h1>{t("login.title")}</h1>
        <p>{t("login.subtitle")}</p>
        <label>
          {t("login.emailLabel")}
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            placeholder={t("login.emailPlaceholder")}
            onChange={(event) => {
              setEmail(event.target.value);
              setError("");
            }}
          />
        </label>
        {error ? <div className="inline-error">{error}</div> : null}
        <Button wide icon="arrow" disabled={busy} onClick={() => void submitEmail()}>
          {t("login.continueEmail")}
        </Button>
        <div className="or"><span />{t("login.or")}<span /></div>
        <Button variant="google" disabled={busy} onClick={() => void submitGoogle()}>
          <b>G</b> {t("login.continueGoogle")}
        </Button>
        <small>{t("login.consent")}</small>
      </section>
    </main>
  );
}


