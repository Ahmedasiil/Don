export const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Add it in your hosting settings.`);
  return v;
}

export const has = (name: string) => Boolean(process.env[name]);
