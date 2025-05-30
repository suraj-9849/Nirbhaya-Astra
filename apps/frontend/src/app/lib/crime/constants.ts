// Configuration values for crime analysis
export const CRIME_ANALYSIS_CONFIG = {
  CELL_SIZE: 0.01, // Grid cell size (approximately 1km)
  SEARCH_RADIUS: 0.005, // Search radius for nearby crime points (approximately 500m)
  CRIME_WEIGHT: 0.7, // Weight given to crime data in safety score
  SAFE_PLACES_WEIGHT: 0.3, // Weight given to safe places in safety score
  HIGH_RISK_THRESHOLD: 1.0, // Threshold for identifying high-risk segments
  MAX_CRIME_SCORE: 2.0, // Maximum expected crime score for normalization
};