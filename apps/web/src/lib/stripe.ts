import Stripe from "stripe";
import { HttpError } from "./http";

export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new HttpError(503, "Payments aren't set up yet. A super admin adds the Stripe keys in the Plugin centre.");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
