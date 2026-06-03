import { prisma } from "../services/prisma.js";

async function main() {
  console.log("=== DIAGNOSING PROFILES AND OUTBOUND MESSAGES ===");
  const profiles = await prisma.profile.findMany({
    include: {
      outboundMessages: true
    }
  });

  console.log(`Found ${profiles.length} profiles.`);
  for (const p of profiles) {
    console.log(`Profile: ${p.id} - ${p.name}`);
    console.log(` - LinkedIn URL: ${p.linkedinUrl}`);
    console.log(` - Messages count: ${p.outboundMessages.length}`);
    for (const m of p.outboundMessages) {
      console.log(`   * Message ID: ${m.id}, Channel: ${m.channel}, Status: ${m.status}, Content: "${m.content.substring(0, 50)}...", CreatedAt: ${m.createdAt}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
