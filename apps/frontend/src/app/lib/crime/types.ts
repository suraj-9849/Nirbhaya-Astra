export interface CrimeDataPoint {
  lat: number;
  long: number;
  crimes: number; // Crime density score
}

export interface HighRiskSegment {
  startIndex: number;
  endIndex: number;
  maxRisk: number;
  avgRisk: number;
  riskPoints: number;
}