import { redirect } from "next/navigation";

// Merged into the User Guide (/steps-use). Kept as a redirect so any saved link
// still resolves.
export default function StepsPrepareRedirect() {
  redirect("/steps-use");
}
