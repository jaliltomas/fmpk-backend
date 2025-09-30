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
import { Session } from './session.entity';

@Entity({ name: 'session_nodes' })
@Index('IDX_session_nodes_session_id', ['sessionId'])
@Index('IDX_session_nodes_session_order', ['sessionId', 'orderIndex'])
export class SessionNode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'session_id' })
  sessionId!: string;

  @ManyToOne(() => Session, (session) => session.nodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'session_id' })
  session!: Session;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int', name: 'order_index' })
  orderIndex!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
