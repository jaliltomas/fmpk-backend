import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1759205771320 implements MigrationInterface {
    name = 'InitSchema1759205771320'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "session_sites" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "base_url" character varying(500) NOT NULL, "file_name" character varying(255) NOT NULL, "product_count" integer NOT NULL DEFAULT '0', "storage_key" character varying(512) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_10154cc9c143016b83c9e092e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_session_sites_session_id" ON "session_sites" ("session_id") `);
        await queryRunner.query(`CREATE TABLE "match_candidates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "match_row_id" uuid NOT NULL, "site_id" uuid, "site_name" character varying(255) NOT NULL, "value" text NOT NULL, "status" boolean, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6ff6206a91e00ded958f53a9839" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_match_candidates_site_id" ON "match_candidates" ("site_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_match_candidates_match_row_id" ON "match_candidates" ("match_row_id") `);
        await queryRunner.query(`CREATE TABLE "match_rows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "product_name" character varying(255) NOT NULL, "order_index" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_87167bb0f2ff963b941a8186bbd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_match_rows_session_order" ON "match_rows" ("session_id", "order_index") `);
        await queryRunner.query(`CREATE INDEX "IDX_match_rows_session_id" ON "match_rows" ("session_id") `);
        await queryRunner.query(`CREATE TABLE "session_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "name" character varying(255) NOT NULL, "order_index" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_751500af3baacbf9324086b51b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_session_nodes_session_order" ON "session_nodes" ("session_id", "order_index") `);
        await queryRunner.query(`CREATE INDEX "IDX_session_nodes_session_id" ON "session_nodes" ("session_id") `);
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "requested_products_count" integer NOT NULL DEFAULT '0', "total_site_products" integer NOT NULL DEFAULT '0', "match_rate" double precision, "validation_stats" jsonb, "requested_products_file_metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_sessions_name" ON "sessions" ("name") `);
        await queryRunner.query(`CREATE TYPE "public"."matching_nodes_type_enum" AS ENUM('EAN', 'Embeddings', 'AIEAN', 'Nombre', 'Descripción')`);
        await queryRunner.query(`CREATE TABLE "matching_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."matching_nodes_type_enum" NOT NULL, "display_name" character varying(255) NOT NULL, "host" character varying(255) NOT NULL, "port" integer NOT NULL, "health_status" character varying(100) NOT NULL DEFAULT 'unknown', "last_heartbeat" TIMESTAMP WITH TIME ZONE, "supported_capabilities" text array NOT NULL DEFAULT ARRAY[]::text[], "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f8b58016a8ba1e84112d964f50a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_matching_nodes_host_port" ON "matching_nodes" ("host", "port") `);
        await queryRunner.query(`CREATE INDEX "IDX_matching_nodes_type" ON "matching_nodes" ("type") `);
        await queryRunner.query(`ALTER TABLE "session_sites" ADD CONSTRAINT "FK_951dccb5c09a08dfeb08b5adca2" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_candidates" ADD CONSTRAINT "FK_f3574856d78d8d98078271c0b22" FOREIGN KEY ("match_row_id") REFERENCES "match_rows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_candidates" ADD CONSTRAINT "FK_3651df4f834597d6efed4628a88" FOREIGN KEY ("site_id") REFERENCES "session_sites"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_rows" ADD CONSTRAINT "FK_c77581eb86eea9e2b6ec6648784" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "session_nodes" ADD CONSTRAINT "FK_84f6e9afa82de8a76589566bc1e" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "session_nodes" DROP CONSTRAINT "FK_84f6e9afa82de8a76589566bc1e"`);
        await queryRunner.query(`ALTER TABLE "match_rows" DROP CONSTRAINT "FK_c77581eb86eea9e2b6ec6648784"`);
        await queryRunner.query(`ALTER TABLE "match_candidates" DROP CONSTRAINT "FK_3651df4f834597d6efed4628a88"`);
        await queryRunner.query(`ALTER TABLE "match_candidates" DROP CONSTRAINT "FK_f3574856d78d8d98078271c0b22"`);
        await queryRunner.query(`ALTER TABLE "session_sites" DROP CONSTRAINT "FK_951dccb5c09a08dfeb08b5adca2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_matching_nodes_type"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_matching_nodes_host_port"`);
        await queryRunner.query(`DROP TABLE "matching_nodes"`);
        await queryRunner.query(`DROP TYPE "public"."matching_nodes_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_sessions_name"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_session_nodes_session_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_session_nodes_session_order"`);
        await queryRunner.query(`DROP TABLE "session_nodes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_rows_session_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_rows_session_order"`);
        await queryRunner.query(`DROP TABLE "match_rows"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_candidates_match_row_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_match_candidates_site_id"`);
        await queryRunner.query(`DROP TABLE "match_candidates"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_session_sites_session_id"`);
        await queryRunner.query(`DROP TABLE "session_sites"`);
    }

}
