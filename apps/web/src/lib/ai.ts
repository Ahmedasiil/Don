import { HttpError } from "./http";

/** The Claude model for Oeno, support and travel. Set it with the API key in Super admin, Plugin centre, Claude AI. */
export function model() {
  const m = process.env.AI_MODEL;
  if (!m) throw new HttpError(503, "The AI assistant isn't set up yet. A super admin adds the Claude model in the Plugin centre.");
  return m;
}
