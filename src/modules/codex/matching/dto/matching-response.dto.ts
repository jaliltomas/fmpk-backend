export type MatchingProductSourceType = 'requested' | 'site';

export interface MatchingProductDto {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  sourceType: MatchingProductSourceType;
  quantity: number | null;
  metadata: Record<string, unknown> | null;
}

export interface MatchingCandidateDto {
  nodeId: string;
  score: number | null;
  product: MatchingProductDto;
}

export interface MatchingRowDto {
  requestedProduct: MatchingProductDto;
  candidates: MatchingCandidateDto[];
}

export interface MatchingResponseDto {
  sessionId: string;
  rows: MatchingRowDto[];
}
