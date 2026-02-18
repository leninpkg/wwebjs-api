
import "dotenv/config";

import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from "./generated/prisma/client";
import getEnvOrThrow from "./helpers/get-env";

const databaseUrl = getEnvOrThrow("DATABASE_URL");

const adapter = new PrismaMariaDb(databaseUrl);
const prisma = new PrismaClient({ adapter });

export { prisma };

