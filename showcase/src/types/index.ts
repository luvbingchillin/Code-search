export interface BenchmarkMetric {
  name: string;
  naiveValue: string;
  astValue: string;
  improvement: string;
  description: string;
  highlight?: boolean;
}

export interface QueryAuditItem {
  id: string;
  query: string;
  targetFile: string;
  naiveRank: string;
  astRank: string;
  status: 'AST Higher' | 'Naive Higher' | 'Tie';
}

export interface ArchitecturePillar {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tech: string[];
  bulletPoints: string[];
  icon: string;
}
