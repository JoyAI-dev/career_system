import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { loadEnvFile } from 'node:process';

function resolveDatasourceUrl(): string {
  return (
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ''
  );
}

try {
  const envFile = process.env.PRISMA_ENV_FILE || '.env.local';
  loadEnvFile(path.join(__dirname, envFile));
} catch {
  // Env file may not exist in CI/production.
}

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  datasource: {
    url: resolveDatasourceUrl(),
  },
  migrate: {
    async resolve({ datasourceUrl }) {
      return {
        url: datasourceUrl ?? resolveDatasourceUrl(),
      };
    },
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
