import { seedInitialData } from "../src/lib/seed-data";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Seeding OmniMarket initial data (60 orders, 15 products)...");
  const result = await seedInitialData(true);
  console.log("Seed completed:", result);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
