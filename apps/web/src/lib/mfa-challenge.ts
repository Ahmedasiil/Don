// Separate key purpose for the 5-minute two-step sign-in challenge.
export const mfaSecret = () => new TextEncoder().encode(`${process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me"}:mfa-challenge`);
