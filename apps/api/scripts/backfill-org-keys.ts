import { prisma } from 'db';
import { EnvKeyProvider } from 'warden-crypto';

// CommonJS has no top-level await, so the work lives in an async function.
async function main(): Promise<void> {
  const masterKeyHex = process.env.MASTER_KEY;
  if (!masterKeyHex)
    throw new Error('MASTER_KEY is not set (run with --env-file=.env)');

  const provider = new EnvKeyProvider({ masterKeyHex });

  const orgs = await prisma.organization.findMany({
    where: { dataKeyWrapped: null },
    select: { id: true, slug: true },
  });

  for (const org of orgs) {
    const { wrapped } = await provider.generateWrappedDek();
    await prisma.organization.update({
      where: { id: org.id },
      data: { dataKeyWrapped: wrapped },
    });
    console.log(`wrapped DEK for ${org.slug}`);
  }

  console.log(`done: ${orgs.length} org(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
