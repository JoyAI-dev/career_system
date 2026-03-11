import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';

try {
  loadEnvFile(path.join(__dirname, '.env.local'));
} catch {
  // .env.local may not exist in CI/production
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
  migrate: {
    async resolve({ datasourceUrl }) {
      return {
        url: datasourceUrl ?? process.env.DATABASE_URL ?? '',
      };
    },
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
