import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchRow } from './match-row.entity';
import { SessionNode } from './session-node.entity';
import { SessionSite } from './session-site.entity';

@Entity({ name: 'sessions' })
@Index('IDX_sessions_name', ['name'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int', name: 'requested_products_count', default: 0 })
  requestedProductsCount!: number;

  @Column({ type: 'int', name: 'total_site_products', default: 0 })
  totalSiteProducts!: number;

  @Column({ type: 'float', name: 'match_rate', nullable: true })
  matchRate?: number | null;

  @Column({ type: 'jsonb', name: 'validation_stats', nullable: true })
  validationStats?: Record<string, unknown> | null;

  @Column({
    type: 'jsonb',
    name: 'requested_products_file_metadata',
    nullable: true,
  })
  requestedProductsFileMetadata?: Record<string, unknown> | null;

  @OneToMany(() => SessionNode, (node) => node.session, { cascade: true })
  nodes!: SessionNode[];

  @OneToMany(() => SessionSite, (site) => site.session, { cascade: true })
  sites!: SessionSite[];

  @OneToMany(() => MatchRow, (matchRow) => matchRow.session, { cascade: true })
  matchRows!: MatchRow[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
