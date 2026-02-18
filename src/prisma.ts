
import "dotenv/config";

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from "./generated/prisma/client";
import getEnvOrThrow from "./helpers/get-env";

const adapter = new PrismaMariaDb({
  host: getEnvOrThrow("DATABASE_HOST"),
  user: getEnvOrThrow("DATABASE_USER"),
  password: getEnvOrThrow("DATABASE_PASSWORD"),
  database: getEnvOrThrow("DATABASE_NAME"),
  connectionLimit: 20,
});

const prisma = new PrismaClient({ adapter });

export { prisma };

