import { JobsBoard } from "@/components/jobs-board";
import { listJobs } from "@/lib/jobs-service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await listJobs();
  const fetchedAt = new Date().toISOString();

  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <JobsBoard jobs={jobs} fetchedAt={fetchedAt} />
    </main>
  );
}
