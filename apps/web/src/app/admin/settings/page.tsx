import { redirect } from "next/navigation";

// Fees, rewards and limits live in the Plugin centre, under Pricing.
export default function Settings() {
  redirect("/admin/plugins#pricing");
}
