import { TelegramDashboard } from "@/components/telegram-dashboard";

export const dynamic = "force-dynamic";

export default function TelegramPage() {
  return (
    <main className="container mx-auto px-4 py-8 md:px-8 flex flex-col gap-8">
      <TelegramDashboard />
    </main>
  );
}
