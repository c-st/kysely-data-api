import RDSDataService from "aws-sdk/clients/rdsdataservice";
import { Kysely } from "kysely";
import { DataApiDialect } from "../src";
import { DataApiDriverConfig } from "../src/data-api-driver";

const TEST_DATABASE = "scratch";

const opts: DataApiDriverConfig = {
  client: new RDSDataService(),
  database: TEST_DATABASE,
  secretArn: process.env.RDS_SECRET,
  resourceArn: process.env.RDS_ARN,
};
const dialect = new DataApiDialect({
  driver: opts,
});

interface Person {
  id: number;
  first_name: string;
  last_name: string;
  gender: "male" | "female" | "other";
}

interface Pet {
  id: number;
  name: string;
  owner_id: number;
  species: "dog" | "cat";
}

interface Movie {
  id: string;
  stars: number;
}

// Keys are table names.
interface Database {
  person: Person;
  pet: Pet;
  movie: Movie;
}

export const db = new Kysely<Database>({ dialect });

export async function reset() {
  await opts.client
    .executeStatement({
      sql: `
      SELECT pg_terminate_backend(pid) FROM  pg_stat_activity WHERE pid <> pg_backend_pid() AND datname = '${TEST_DATABASE}'`,
      database: "postgres",
      secretArn: opts.secretArn,
      resourceArn: opts.resourceArn,
    })
    .promise();

  await opts.client
    .executeStatement({
      sql: `DROP DATABASE IF EXISTS ${TEST_DATABASE}`,
      database: "postgres",
      secretArn: opts.secretArn,
      resourceArn: opts.resourceArn,
    })
    .promise();

  await opts.client
    .executeStatement({
      sql: `CREATE DATABASE ${TEST_DATABASE}`,
      database: "postgres",
      secretArn: opts.secretArn,
      resourceArn: opts.resourceArn,
    })
    .promise();

  await db.schema
    .createTable("person")
    .addColumn("id", "integer", (col) => col.increments().primaryKey())
    .addColumn("first_name", "varchar")
    .addColumn("last_name", "varchar")
    .addColumn("gender", "varchar(50)")
    .execute();

  await db.schema
    .createTable("pet")
    .addColumn("id", "integer", (col) => col.increments().primaryKey())
    .addColumn("name", "varchar", (col) => col.notNull().unique())
    .addColumn("owner_id", "integer", (col) =>
      col.references("person.id").onDelete("cascade")
    )
    .addColumn("species", "varchar")
    .execute();

  await db.schema
    .createIndex("pet_owner_id_index")
    .on("pet")
    .column("owner_id")
    .execute();
}
