export type CrisisType = 'conflict' | 'famine' | 'displacement' | 'disaster';

export type Region = {
  region_id: string;
  name: string;
  country_code: string;
  lat: number;
  lng: number;
  severity_score: number;  // 0-1
  crisis_type: CrisisType;
  summary?: string;
  source_links?: { name: string; url: string }[];
  // these come later when blockchain is wired up
  pool_address?: string;
  pool_balance_usdc?: number;
};
