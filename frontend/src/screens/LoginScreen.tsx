import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/Button";
import { SparrowLogo } from "../components/SparrowLogo";
import { LoginScene } from "../components/scenes/Scenes";
import { useAuth } from "../lib/AuthProvider";
import { nextRoute, type Profile } from "../lib/types";
import { AuthError, type AuthErrorCode } from "../lib/api/auth";
import { consumeSessionExpired } from "../lib/api/session";
import { COGNITO_GOOGLE, USE_MOCK } from "../lib/env";
import { clearDemo, isDemoPending } from "../lib/demo";
import { resetApi } from "../lib/api";

/**
 * Login. Email + password (or Google when it is configured). There is NO
 * phone/OTP path.
 *
 * Mock mode keeps the original email-only screen (and its simulated Google
 * button). Real mode (VITE_USE_MOCK=false) uses Cognito: sign in, create
 * account with a 6-digit confirmation code, and forgot-password.
 */
type Mode = "signin" | "signup" | "confirm" | "forgot" | "reset";

const MIN_PASSWORD = 8;

function errorKey(code: AuthErrorCode): string {
  return `login.error${code.charAt(0).toUpperCase()}${code.slice(1)}`;
}

export function LoginScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>(() => (location.state?.mode === "signup" ? "signup" : "signin"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const clearDemoBeforeAuth = () => {
    if (isDemoPending()) {
      clearDemo();
      resetApi();
    }
  };

  // A 401 in real mode signs the user out and routes here.
  useEffect(() => {
    if (consumeSessionExpired()) setNotice(t("login.sessionExpired"));
  }, [t]);

  const messageFor = (err: unknown): string =>
    err instanceof AuthError ? t(errorKey(err.code)) : t("login.errorUnknown");

  const go = (profile: Profile | null) => {
    const destination = location.state?.from;
    navigate(destination && destination.startsWith("/app/") ? destination : nextRoute(profile), { replace: true });
  };

  if (USE_MOCK) {
    const submitEmail = async () => {
      if (!email.includes("@")) {
        setError(t("login.emailError"));
        return;
      }
      setBusy(true);
      clearDemoBeforeAuth();
      try {
        go(await auth.signInWithEmail(email));
      } finally {
        setBusy(false);
      }
    };
    const submitGoogle = async () => {
      setBusy(true);
      clearDemoBeforeAuth();
      try {
        go(await auth.signInWithGoogle());
      } finally {
        setBusy(false);
      }
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

  const submitSignIn = async () => {
    if (!email.includes("@")) {
      setError(t("login.emailError"));
      return;
    }
    if (!password) {
      setError(t("login.passwordError"));
      return;
    }
    setBusy(true);
    clearDemoBeforeAuth();
    setError("");
    setNotice("");
    try {
      go(await auth.signInWithEmail(email.trim(), password));
    } catch (err) {
      if (err instanceof AuthError && err.code === "unconfirmed") {
        setMode("confirm");
        setNotice(t("login.errorUnconfirmed"));
      } else {
        setError(messageFor(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitSignUp = async () => {
    if (!email.includes("@")) {
      setError(t("login.emailError"));
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(t("login.errorInvalidPassword"));
      return;
    }
    setBusy(true);
    clearDemoBeforeAuth();
    setError("");
    try {
      await auth.signUp(email.trim(), password);
      setMode("confirm");
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    if (code.trim().length < 6) {
      setError(t("login.codeError"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.confirmSignUp(email.trim(), code.trim());
      go(await auth.signInWithEmail(email.trim(), password));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    setBusy(true);
    setError("");
    try {
      await auth.resendSignUpCode(email.trim());
      setNotice(t("login.resendSent"));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    if (!email.includes("@")) {
      setError(t("login.emailError"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.resetPassword(email.trim());
      setMode("reset");
      setNotice(t("login.resetSent", { email: email.trim() }));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async () => {
    if (code.trim().length < 6) {
      setError(t("login.codeError"));
      return;
    }
    if (newPassword.length < MIN_PASSWORD) {
      setError(t("login.errorInvalidPassword"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.confirmResetPassword(email.trim(), code.trim(), newPassword);
      go(await auth.signInWithEmail(email.trim(), newPassword));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  const titleKey: Record<Mode, string> = {
    signin: "login.title",
    signup: "login.signupTitle",
    confirm: "login.confirmTitle",
    forgot: "login.forgotTitle",
    reset: "login.resetTitle",
  };
  const subtitleKey: Record<Mode, string> = {
    signin: "login.subtitle",
    signup: "login.signupSubtitle",
    confirm: "login.confirmSubtitle",
    forgot: "login.forgotSubtitle",
    reset: "login.resetSubtitle",
  };

  const emailField = (
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
  );

  const passwordField = (
    <label>
      {t("login.passwordLabel")}
      <input
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        value={password}
        placeholder={t("login.passwordPlaceholder")}
        onChange={(event) => {
          setPassword(event.target.value);
          setError("");
        }}
      />
    </label>
  );

  const codeField = (
    <label>
      {t("login.codeLabel")}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        placeholder={t("login.codePlaceholder")}
        onChange={(event) => {
          setCode(event.target.value.replace(/\D/g, ""));
          setError("");
        }}
      />
    </label>
  );

  return (
    <main className="auth-screen">
      <aside>
        <LoginScene />
      </aside>
      <section className="auth-panel">
        <div className="auth-top">
          <button
            type="button"
            onClick={() => {
              if (mode === "signin") navigate("/welcome");
              else {
                setMode("signin");
                setError("");
                setNotice("");
                setCode("");
              }
            }}
          >
            ← {mode === "signin" ? t("login.back") : t("login.backToSignIn")}
          </button>
        </div>
        <SparrowLogo />
        <div className="eyebrow">{t("login.eyebrow")}</div>
        <h1>{t(titleKey[mode])}</h1>
        <p>{t(subtitleKey[mode], { email: email.trim() })}</p>

        {mode === "signin" || mode === "signup" ? emailField : null}
        {mode === "signin" || mode === "signup" ? passwordField : null}
        {mode === "signup" ? <small className="field-hint">{t("login.passwordHint")}</small> : null}
        {mode === "confirm" ? codeField : null}
        {mode === "reset" ? codeField : null}
        {mode === "reset" ? (
          <label>
            {t("login.newPasswordLabel")}
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              placeholder={t("login.passwordPlaceholder")}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setError("");
              }}
            />
          </label>
        ) : null}

        {error ? <div className="inline-error">{error}</div> : null}
        {notice && !error ? <div className="figure-note">{notice}</div> : null}

        {mode === "signin" ? (
          <Button wide icon="arrow" disabled={busy} onClick={() => void submitSignIn()}>
            {t("login.signIn")}
          </Button>
        ) : null}
        {mode === "signup" ? (
          <Button wide icon="arrow" disabled={busy} onClick={() => void submitSignUp()}>
            {t("login.createAccount")}
          </Button>
        ) : null}
        {mode === "confirm" ? (
          <Button wide icon="arrow" disabled={busy} onClick={() => void submitCode()}>
            {t("login.confirm")}
          </Button>
        ) : null}
        {mode === "forgot" ? (
          <Button wide icon="arrow" disabled={busy} onClick={() => void submitForgot()}>
            {t("login.sendCode")}
          </Button>
        ) : null}
        {mode === "reset" ? (
          <Button wide icon="arrow" disabled={busy} onClick={() => void submitReset()}>
            {t("login.resetSubmit")}
          </Button>
        ) : null}

        {mode === "signin" ? (
          <button type="button" className="text-button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>
            {t("login.forgot")}
          </button>
        ) : null}
        {mode === "confirm" ? (
          <button type="button" className="text-button" disabled={busy} onClick={() => void resendCode()}>
            {t("login.resend")}
          </button>
        ) : null}
        {mode === "signin" || mode === "signup" ? (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError("");
              setNotice("");
            }}
          >
            {mode === "signin" ? t("login.newHere") : t("login.haveAccount")}
          </button>
        ) : null}

        {COGNITO_GOOGLE ? (
          <>
            <div className="or"><span />{t("login.or")}<span /></div>
            <Button variant="google" disabled={busy} onClick={() => void auth.signInWithGoogle()}>
              <b>G</b> {t("login.continueGoogle")}
            </Button>
          </>
        ) : null}
        <small>{t("login.consent")}</small>
      </section>
    </main>
  );
}
