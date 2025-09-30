import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchCandidate } from './match-candidate.entity';
import { Session } from './session.entity';

@Entity({ name: 'session_sites' })
@Index('IDX_session_sites_session_id', ['sessionId'])
export class SessionSite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @ManyToOne(() => Session, (session) => session.sites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session!: Session;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 500, name: 'base_url' })
  baseUrl!: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName!: string;

  @Column({ type: 'int', name: 'product_count', default: 0 })
  productCount!: number;

  @Column({ type: 'varchar', length: 512, name: 'storage_key' })
  storageKey!: string;

  @OneToMany(() => MatchCandidate, (candidate) => candidate.site)
  matchCandidates!: MatchCandidate[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
