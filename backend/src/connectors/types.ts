export interface Job {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  applyUrl?: string | null;
  experienceLevel?: string;
  fingerprint?: string;
  notes?: string;
}

export interface JobConnector<TSearchConfig> {
  source: string;
  search(config: TSearchConfig): Promise<Job[]>;
}
