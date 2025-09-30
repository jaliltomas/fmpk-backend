import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AvailableNode } from './available-node.enum';

@Entity({ name: 'matching_nodes' })
@Index('IDX_matching_nodes_type', ['type'])
@Index('UQ_matching_nodes_host_port', ['host', 'port'], { unique: true })
export class MatchingNode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: AvailableNode })
  type!: AvailableNode;

  @Column({ type: 'varchar', length: 255, name: 'display_name' })
  displayName!: string;

  @Column({ type: 'varchar', length: 255 })
  host!: string;

  @Column({ type: 'int' })
  port!: number;

  @Column({ type: 'varchar', length: 100, name: 'health_status', default: 'unknown' })
  healthStatus!: string;

  @Column({ type: 'timestamptz', name: 'last_heartbeat', nullable: true })
  lastHeartbeat?: Date | null;

  @Column({
    type: 'text',
    array: true,
    name: 'supported_capabilities',
    default: () => 'ARRAY[]::text[]',
  })
  supportedCapabilities!: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
