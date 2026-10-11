import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import i18n from "../../i18n";
import { AuthError } from "../../lib/api/auth";
import { LoginScreen } from "../LoginScreen";

/** env + auth are mocked so both mock and real modes can be exercised here. */
const env = vi.hoisted(() => ({ USE_MOCK: true, COGNITO_GOOGLE: false }));
vi.mock("../../lib/env", () => ({
  get USE_MOCK() {
    return env.USE_MOCK;
  },
  get COGNITO_GOOGLE() {
    return env.COGNITO_GOOGLE;
  },
}));

const auth = vi.hoisted(() => ({
  signInWithEmail: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  signInWithGoogle: vi.fn(),
}));

vi.mock("../../lib/AuthProvider", () => ({ useAuth: () => auth }));

function renderLogin() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/story" element={<div>STORY GATE</div>} />
          <Route path="/setup" element={<div>SETUP GATE</div>} />
          <Route path="/app" element={<div>APP GATE</div>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const passwordInput = () => document.querySelector('input[type="password"]');

beforeEach(async () => {
  await i18n.changeLanguage("en");
  env.USE_MOCK = true;
  env.COGNITO_GOOGLE = false;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("login screen modes", () => {
  it("mock mode keeps the email-only screen and the simulated Google button", () => {
    renderLogin();
    expect(screen.getByText("Continue with email")).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    expect(passwordInput()).toBeNull();
    expect(screen.queryByText("New here? Create account")).toBeNull();
  });

  it("real mode asks for a password and hides Google unless it is configured", () => {
    env.USE_MOCK = false;
    renderLogin();
    expect(passwordInput()).not.toBeNull();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.queryByText("Continue with Google")).toBeNull();
    expect(screen.getByText("New here? Create account")).toBeInTheDocument();
  });

  it("real mode shows Google only when VITE_COGNITO_GOOGLE=true", () => {
    env.USE_MOCK = false;
    env.COGNITO_GOOGLE = true;
    renderLogin();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
  });

  it("real mode toggles to create-account with the password requirement", async () => {
    env.USE_MOCK = false;
    renderLogin();
    await userEvent.click(screen.getByText("New here? Create account"));
    expect(screen.getByText("Create account")).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Have an account? Sign in")).toBeInTheDocument();
  });

  it("real mode signs in and routes through the story gate", async () => {
    env.USE_MOCK = false;
    auth.signInWithEmail.mockResolvedValue({ introSeen: false, setupComplete: false, user: { id: "s" } });
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.type(passwordInput() as HTMLInputElement, "password123");
    await userEvent.click(screen.getByText("Sign in"));
    expect(auth.signInWithEmail).toHaveBeenCalledWith("a@b.com", "password123");
    expect(await screen.findByText("STORY GATE")).toBeInTheDocument();
  });

  it("real mode maps a wrong password to friendly copy", async () => {
    env.USE_MOCK = false;
    auth.signInWithEmail.mockRejectedValue(new AuthError("wrongPassword"));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.type(passwordInput() as HTMLInputElement, "nope");
    await userEvent.click(screen.getByText("Sign in"));
    expect(await screen.findByText("That email or password doesn't look right.")).toBeInTheDocument();
  });

  it("real mode sends an unconfirmed user to the code screen with resend", async () => {
    env.USE_MOCK = false;
    auth.signInWithEmail.mockRejectedValue(new AuthError("unconfirmed"));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.type(passwordInput() as HTMLInputElement, "password123");
    await userEvent.click(screen.getByText("Sign in"));
    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(screen.getByText("Resend code")).toBeInTheDocument();
  });

  it("real mode offers forgot-password", async () => {
    env.USE_MOCK = false;
    auth.resetPassword.mockResolvedValue(undefined);
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.click(screen.getByText("Forgot password?"));
    expect(await screen.findByText("Reset your password")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Send code"));
    expect(auth.resetPassword).toHaveBeenCalledWith("a@b.com");
  });

  /** Drives the screen to the confirm step via an unconfirmed sign-in. */
  async function toConfirmMode() {
    auth.signInWithEmail.mockRejectedValueOnce(new AuthError("unconfirmed"));
    renderLogin();
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.type(passwordInput() as HTMLInputElement, "password123");
    await userEvent.click(screen.getByText("Sign in"));
    await screen.findByText("Check your email");
  }

  it("confirm succeeds but auto sign-in fails: banner, no error", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockResolvedValue(undefined);
    auth.signInWithEmail.mockRejectedValue(new AuthError("wrongPassword"));
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText("Email confirmed. Please sign in.")).toBeInTheDocument();
    expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("a@b.com");
    expect(screen.queryByText("That email or password doesn't look right.")).toBeNull();
  });

  it("is single-flight: a double submit makes one confirm call", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    let release: (() => void) | undefined;
    auth.confirmSignUp.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    auth.signInWithEmail.mockResolvedValue({ introSeen: true, setupComplete: true, user: { id: "s" } });
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    const button = screen.getByText("Confirm");
    await userEvent.click(button);
    await userEvent.click(button);
    expect(auth.confirmSignUp).toHaveBeenCalledTimes(1);
    await act(async () => {
      release?.();
    });
  });

  it("resend starts a visible cooldown and clears the old code", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.resendSignUpCode.mockResolvedValue(undefined);
    await userEvent.click(screen.getByText("Resend code"));
    expect(await screen.findByText("A new code was sent. The old code no longer works.")).toBeInTheDocument();
    expect(auth.resendSignUpCode).toHaveBeenCalledWith("a@b.com");
    expect(screen.getByRole("button", { name: "Resend code in 30s" })).toBeDisabled();
  });

  it("an expired code still signs in an already-confirmed account", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockRejectedValue(new AuthError("expiredCode"));
    auth.signInWithEmail.mockResolvedValue({ introSeen: true, setupComplete: true, user: { id: "s" } });
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText("APP GATE")).toBeInTheDocument();
  });

  it("an expired code on an unconfirmed account offers a resend", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockRejectedValue(new AuthError("expiredCode"));
    auth.signInWithEmail.mockRejectedValue(new AuthError("unconfirmed"));
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText(/Confirm your email first/)).toBeInTheDocument();
    expect(screen.getByText("Resend code")).toBeInTheDocument();
  });

  it("maps a wrong code to its own friendly message", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockRejectedValue(new AuthError("badCode"));
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText("That code isn't right. Check your email and try again.")).toBeInTheDocument();
  });

  it("shows the technical error name in real mode only", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockRejectedValue(new AuthError("badCode", "bad", "CodeMismatchException"));
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    expect(await screen.findByText("Details: CodeMismatchException")).toBeInTheDocument();
  });

  it("never writes the password to storage", async () => {
    env.USE_MOCK = false;
    await toConfirmMode();
    auth.confirmSignUp.mockRejectedValue(new AuthError("badCode"));
    await userEvent.type(screen.getByLabelText("Confirmation code"), "123456");
    await userEvent.click(screen.getByText("Confirm"));
    await screen.findByText("That code isn't right. Check your email and try again.");
    expect(JSON.stringify(localStorage) + JSON.stringify(sessionStorage)).not.toContain("password123");
  });

  it("shows Cognito's password policy text when sign-up rejects", async () => {
    env.USE_MOCK = false;
    renderLogin();
    await userEvent.click(screen.getByText("New here? Create account"));
    await userEvent.type(screen.getByLabelText("Email address"), "a@b.com");
    await userEvent.type(passwordInput() as HTMLInputElement, "password123");
    auth.signUp.mockRejectedValue(
      new AuthError("invalidPassword", "Password does not conform to policy: at least 6 characters", "InvalidPasswordException"),
    );
    await userEvent.click(screen.getByText("Create account"));
    expect(await screen.findByText("Password does not conform to policy: at least 6 characters")).toBeInTheDocument();
  });
});
