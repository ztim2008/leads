const p = require(" @prisma/client\);
const b = require(cryptjs\);
(async () => {
 const prisma = new p.PrismaClient();
 const h = await b.hash(
astya2025!\, 10);
 await prisma.user.update({ where: { email: \kapibara231@bk.ru\ }, data: { passwordHash: h } });
 console.log(\OK\);
 await prisma.\();
})();
