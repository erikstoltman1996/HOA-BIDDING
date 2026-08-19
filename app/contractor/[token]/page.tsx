import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { ContractorUpdateForm } from "@/components/contractor/ContractorUpdateForm";

export default async function ContractorUpdatePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: contractor } = await supabase
    .from("contractors")
    .select("*, projects(title)")
    .eq("access_token", token)
    .maybeSingle();

  if (!contractor) notFound();

  const projectTitle =
    (contractor as unknown as { projects: { title: string } }).projects?.title || "your project";

  return (
    <div className="min-h-screen w-full bg-paper p-4 sm:p-8">
      <div className="mx-auto max-w-lg rounded border border-rule bg-paper-card p-5 sm:p-8">
        <ContractorUpdateForm token={token} projectTitle={projectTitle} contractorName={contractor.name} />
      </div>
    </div>
  );
}
