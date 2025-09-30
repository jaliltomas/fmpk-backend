import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchRow } from './match-row.entity';
import { SessionSite } from './session-site.entity';

@Entity({ name: 'match_candidates' })
@Index('IDX_match_candidates_match_row_id', ['matchRowId'])
@Index('IDX_match_candidates_site_id', ['siteId'])
export class MatchCandidate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'match_row_id' })
  matchRowId!: string;

  @ManyToOne(() => MatchRow, (matchRow) => matchRow.candidates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'match_row_id' })
  matchRow!: MatchRow;

  @Column({ type: 'uuid', name: 'site_id', nullable: true })
  siteId?: string | null;

  @ManyToOne(() => SessionSite, (site) => site.matchCandidates, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'site_id' })
  site?: SessionSite | null;

  @Column({ type: 'varchar', length: 255, name: 'site_name' })
  siteName!: string;

  @Column({ type: 'text' })
  value!: string;

  @Column({ type: 'boolean', nullable: true })
  status?: boolean | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
