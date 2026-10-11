import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real Cognito provider. aws-amplify is mocked: this proves our mapping
 * (usernames, codes, friendly error codes) without touching the network.
 */
const amplify = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  confirmSignUp: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
  confirmResetPassword: vi.fn(),
  signOut: vi.fn(),
  signInWithRedirect: vi.fn(),
  fetchAuthSession: vi.fn(),
  deleteUser: vi.fn(),
}));

const configure = vi.hoisted(() => vi.fn());

vi.mock("aws-amplify", () => ({ Amplify: { configure } }));
vi.mock("aws-amplify/auth", () => amplify);

/**
 * Hub is a tiny in-test event bus: the provider subscribes to it to learn when
 * Amplify's OAuth code exchange finishes (or fails).
 */
const hub = vi.hoisted(() => {
  type Payload = { payload: { event: string; data?: unknown } };
  const listeners: Array<(arg: Payload) => void> = [];
  return {
    listeners,
    listen: vi.fn((_channel: string, cb: (arg: Payload) => void) => {
      listeners.push(cb);
      return () => {
        const index = listeners.indexOf(cb);
        if (index >= 0) listeners.splice(index, 1);
      };
    }),
    emit(event: string, data?: unknown) {
      for (const cb of [...listeners]) cb({ payload: { event, data } });
    },
  };
});
vi.mock("aws-amplify/utils", () => ({ Hub: { listen: hub.listen } }));

type CognitoModule = typeof import("../cognito");
let createCognitoAuthProvider: CognitoModule["createCognitoAuthProvider"];

function sessionWithIdToken(payload: Record<string, unknown>, token = "id-token") {
  return { userSub: payload.sub, tokens: { idToken: { payload, toString: () => token } } };
}

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("VITE_COGNITO_REGION", "ap-south-1");
  vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "ap-south-1_TEST");
  vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
  vi.stubEnv("VITE_COGNITO_DOMAIN", "test.auth.ap-south-1.amazoncognito.com");
  vi.clearAllMocks();
  hub.listeners.length = 0;
  ({ createCognitoAuthProvider } = await import("../cognito"));
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cognito auth provider (real mode)", () => {
  it("signs in and builds the user from the ID token claims", async () => {
    amplify.signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: "DONE" } });
    amplify.fetchAuthSession.mockResolvedValue(
      sessionWithIdToken({ sub: "sub-1", email: "a@b.com", name: "Ananya Rao" }),
    );

    const { user } = await createCognitoAuthProvider().signInWithEmail("A@B.com", "password123");

    expect(amplify.signIn).toHaveBeenCalledWith({ username: "a@b.com", password: "password123" });
    expect(user).toEqual({ id: "sub-1", email: "a@b.com", displayName: "Ananya Rao", provider: "email" });
  });

  it("marks a federated account as Google", async () => {
    amplify.fetchAuthSession.mockResolvedValue(
      sessionWithIdToken({ sub: "sub-2", email: "g@b.com", name: "G", identities: [{ providerName: "Google" }] }),
    );
    const user = await createCognitoAuthProvider().getCurrentUser();
    expect(user).toMatchObject({ id: "sub-2", provider: "google" });
  });

  it("returns null when there is no session", async () => {
    amplify.fetchAuthSession.mockResolvedValue({});
    expect(await createCognitoAuthProvider().getCurrentUser()).toBeNull();
  });

  it("maps a wrong password to a friendly code", async () => {
    amplify.signIn.mockRejectedValue(Object.assign(new Error("nope"), { name: "NotAuthorizedException" }));
    await expect(createCognitoAuthProvider().signInWithEmail("a@b.com", "x")).rejects.toMatchObject({
      code: "wrongPassword",
    });
  });

  it("asks for confirmation when the user has not confirmed yet", async () => {
    amplify.signIn.mockResolvedValue({ isSignedIn: false, nextStep: { signInStep: "CONFIRM_SIGN_UP" } });
    await expect(createCognitoAuthProvider().signInWithEmail("a@b.com", "x")).rejects.toMatchObject({
      code: "unconfirmed",
    });
  });

  it("signs up and asks for the emailed code", async () => {
    amplify.signUp.mockResolvedValue({ isSignUpComplete: false, nextStep: { signUpStep: "CONFIRM_SIGN_UP" } });
    const result = await createCognitoAuthProvider().signUp("New@User.com", "password123");
    expect(amplify.signUp).toHaveBeenCalledWith({
      username: "new@user.com",
      password: "password123",
      options: { userAttributes: { email: "new@user.com" } },
    });
    expect(result).toEqual({ needsConfirmation: true, username: "new@user.com" });
  });

  it("maps an existing account to a friendly code", async () => {
    amplify.signUp.mockRejectedValue(Object.assign(new Error("exists"), { name: "UsernameExistsException" }));
    await expect(createCognitoAuthProvider().signUp("a@b.com", "password123")).rejects.toMatchObject({
      code: "userExists",
    });
  });

  it("confirms and resends the sign-up code", async () => {
    amplify.confirmSignUp.mockResolvedValue({});
    amplify.resendSignUpCode.mockResolvedValue({});
    const auth = createCognitoAuthProvider();
    await auth.confirmSignUp("a@b.com", " 123456 ");
    await auth.resendSignUpCode("a@b.com");
    expect(amplify.confirmSignUp).toHaveBeenCalledWith({ username: "a@b.com", confirmationCode: "123456" });
    expect(amplify.resendSignUpCode).toHaveBeenCalledWith({ username: "a@b.com" });
  });

  it("maps a bad / expired code", async () => {
    amplify.confirmSignUp.mockRejectedValue(Object.assign(new Error("bad"), { name: "CodeMismatchException" }));
    await expect(createCognitoAuthProvider().confirmSignUp("a@b.com", "000000")).rejects.toMatchObject({
      code: "badCode",
    });
    amplify.confirmSignUp.mockRejectedValue(Object.assign(new Error("old"), { name: "ExpiredCodeException" }));
    await expect(createCognitoAuthProvider().confirmSignUp("a@b.com", "000000")).rejects.toMatchObject({
      code: "expiredCode",
    });
  });

  it("resets a forgotten password", async () => {
    amplify.resetPassword.mockResolvedValue({});
    amplify.confirmResetPassword.mockResolvedValue({});
    const auth = createCognitoAuthProvider();
    await auth.resetPassword("a@b.com");
    await auth.confirmResetPassword("a@b.com", "123456", "newpassword");
    expect(amplify.resetPassword).toHaveBeenCalledWith({ username: "a@b.com" });
    expect(amplify.confirmResetPassword).toHaveBeenCalledWith({
      username: "a@b.com",
      confirmationCode: "123456",
      newPassword: "newpassword",
    });
  });

  it("maps a network failure", async () => {
    amplify.signIn.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(createCognitoAuthProvider().signInWithEmail("a@b.com", "x")).rejects.toMatchObject({
      code: "network",
    });
  });

  it("returns the ID token and signs out / deletes the user", async () => {
    amplify.fetchAuthSession.mockResolvedValue(sessionWithIdToken({ sub: "sub-3" }, "the-token"));
    amplify.signOut.mockResolvedValue({});
    amplify.deleteUser.mockResolvedValue({});
    const auth = createCognitoAuthProvider();
    expect(await auth.idToken()).toBe("the-token");
    await auth.signOut();
    await auth.deleteUser();
    expect(amplify.signOut).toHaveBeenCalled();
    expect(amplify.deleteUser).toHaveBeenCalled();
  });

  it("configures Amplify once with the pool and hosted-UI domain", async () => {
    amplify.fetchAuthSession.mockResolvedValue({});
    await createCognitoAuthProvider().getCurrentUser();
    await createCognitoAuthProvider().getCurrentUser();
    expect(configure).toHaveBeenCalledTimes(1);
    const config = configure.mock.calls[0][0] as { Auth: { Cognito: Record<string, unknown> } };
    expect(config.Auth.Cognito.userPoolId).toBe("ap-south-1_TEST");
    expect(config.Auth.Cognito.userPoolClientId).toBe("test-client");
    expect(config.Auth.Cognito.loginWith).toMatchObject({
      oauth: { domain: "test.auth.ap-south-1.amazoncognito.com", responseType: "code" },
    });
  });

  it("redirects to Google through the Hosted UI", async () => {
    amplify.fetchAuthSession.mockResolvedValue({});
    amplify.signInWithRedirect.mockResolvedValue(undefined);
    // Loads + configures first, so the redirect call is deterministic.
    await createCognitoAuthProvider().getCurrentUser();
    void createCognitoAuthProvider().signInWithGoogle();
    await vi.waitFor(() => expect(amplify.signInWithRedirect).toHaveBeenCalledWith({ provider: "Google" }));
  });

  it("maps a confirm-time NotAuthorizedException to 'already confirmed'", async () => {
    amplify.confirmSignUp.mockRejectedValue(Object.assign(new Error("nope"), { name: "NotAuthorizedException" }));
    await expect(createCognitoAuthProvider().confirmSignUp("a@b.com", "123456")).rejects.toMatchObject({
      code: "alreadyConfirmed",
      detail: "NotAuthorizedException",
    });
  });

  it("maps an unknown account on resend / confirm", async () => {
    amplify.confirmSignUp.mockRejectedValue(Object.assign(new Error("gone"), { name: "UserNotFoundException" }));
    await expect(createCognitoAuthProvider().confirmSignUp("a@b.com", "123456")).rejects.toMatchObject({
      code: "userNotFound",
      detail: "UserNotFoundException",
    });
    amplify.resendSignUpCode.mockRejectedValue(Object.assign(new Error("gone"), { name: "UserNotFoundException" }));
    await expect(createCognitoAuthProvider().resendSignUpCode("a@b.com")).rejects.toMatchObject({
      code: "userNotFound",
      detail: "UserNotFoundException",
    });
  });

  it("maps a limit error on confirm", async () => {
    amplify.confirmSignUp.mockRejectedValue(Object.assign(new Error("slow down"), { name: "LimitExceededException" }));
    await expect(createCognitoAuthProvider().confirmSignUp("a@b.com", "123456")).rejects.toMatchObject({ code: "limit" });
  });

  it("keeps Cognito's password policy text for InvalidPasswordException", async () => {
    const policy = "Password does not conform to policy: at least 6 characters";
    amplify.signUp.mockRejectedValue(Object.assign(new Error(policy), { name: "InvalidPasswordException" }));
    await expect(createCognitoAuthProvider().signUp("a@b.com", "short")).rejects.toMatchObject({
      code: "invalidPassword",
      message: policy,
      detail: "InvalidPasswordException",
    });
  });

  it("waits for the OAuth exchange and returns the signed-in user", async () => {
    let dispatched = false;
    amplify.fetchAuthSession.mockImplementation(async () => {
      if (!dispatched) {
        dispatched = true;
        hub.emit("signInWithRedirect");
      }
      return sessionWithIdToken({ sub: "s1", email: "g@b.com", name: "G", identities: [{}] });
    });
    const { user, error } = await createCognitoAuthProvider().completeOAuthRedirect();
    expect(error).toBeNull();
    expect(user).toMatchObject({ id: "s1", provider: "google" });
  });

  it("surfaces the OAuth failure description from the Hub event", async () => {
    amplify.fetchAuthSession.mockImplementation(() => new Promise(() => {}));
    const pending = createCognitoAuthProvider().completeOAuthRedirect();
    await vi.waitFor(() => expect(amplify.fetchAuthSession).toHaveBeenCalled());
    hub.emit("signInWithRedirect_failure", { error: { name: "OAuthError", message: "access_denied" } });
    await expect(pending).resolves.toEqual({ user: null, error: "access_denied" });
  });

  it("resolves with no error when there is no OAuth flow to finish", async () => {
    amplify.fetchAuthSession.mockResolvedValue({});
    await expect(createCognitoAuthProvider().completeOAuthRedirect()).resolves.toEqual({ user: null, error: null });
  });
});
