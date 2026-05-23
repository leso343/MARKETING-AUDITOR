/**
 * /setup — admin-only configuration shell. H-6 fix: previously this
 * was a client component with no auth check, so any agency-role user
 * could load the page; the underlying admin APIs would then 403 and
 * the UI silently broke.
 *
 * Server-rendered, calls requireAdmin() which redirects non-admins
 * to "/". The actual UI lives in ./SetupClient.tsx.
 */
import { requireAdmin } from "@/lib/access";
import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await requireAdmin();
  return <SetupClient />;
}
