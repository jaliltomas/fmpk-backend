import { Injectable } from '@nestjs/common';

export interface MatchingNode {
  id: string;
  host: string;
  port: number;
  type: string;
}

@Injectable()
export class MatchingNodeRepository {
  private readonly nodes: MatchingNode[] = [
    { id: 'nodeA', host: 'localhost', port: 8081, type: 'AIEAN' },
    { id: 'nodeB', host: 'localhost', port: 8082, type: 'OTHER' },
  ];

  findById(id: string): MatchingNode | undefined {
    return this.nodes.find((node) => node.id === id);
  }

  findAll(): MatchingNode[] {
    return [...this.nodes];
  }
}
