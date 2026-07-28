const p = require('@prisma/client');
(async () => {
  const prisma = new p.PrismaClient();
  const u = await prisma.user.findUnique({ where: { email: 'kapibara231@bk.ru' } });
  console.log('hash:', u.passwordHash ? u.passwordHash.slice(0, 30) : 'NULL');
  await prisma.\();
})();
