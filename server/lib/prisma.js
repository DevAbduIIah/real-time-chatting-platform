const path = require('path');
const { PrismaClient } = require('../generated/prisma');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

function resolveSqlitePath(databaseUrl) {
  const rawValue = databaseUrl || 'file:./prisma/dev.db';

  if (!rawValue.startsWith('file:')) {
    return rawValue;
  }

  const filePath = rawValue.slice('file:'.length);

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.resolve(__dirname, '..', filePath);
}

const adapter = new PrismaBetterSqlite3({
  url: resolveSqlitePath(process.env.DATABASE_URL),
});

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
