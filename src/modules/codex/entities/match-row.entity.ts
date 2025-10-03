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

@Entity({ name: 'match_rows' })
@Index('IDX_match_rows_session_id', ['sessionId'])
@Index('IDX_match_rows_session_order', ['sessionId', 'orderIndex'])
export class MatchRow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @ManyToOne(() => Session, (session) => session.matchRows, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session!: Session;

  @Column({ type: 'varchar', length: 255, name: 'product_name' })
  productName!: string;

  @Column({ type: 'int', name: 'order_index' })
  orderIndex!: number;

  @OneToMany(() => MatchCandidate, (candidate) => candidate.matchRow, {
    cascade: true,
  })
  candidates!: MatchCandidate[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
