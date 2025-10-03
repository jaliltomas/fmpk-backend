export const REQUESTED_PRODUCTS_SITE_ID = 'requested-products';
export const REQUESTED_PRODUCTS_SITE_NAME = 'Requested products';

export interface RequestedProductRecord {
  id: string;
  name: string;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
}

export interface RequestedProductsSite {
  siteId: string;
  siteName: string;
  products: RequestedProductRecord[];
}
