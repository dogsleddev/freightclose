import { redirect } from "next/navigation";

// Data Import merged into "Run a close" (/close): load a sample or upload your
// own, in one place. Kept as a redirect so any saved link still resolves.
export default function ImportRedirect() {
  redirect("/close");
}
