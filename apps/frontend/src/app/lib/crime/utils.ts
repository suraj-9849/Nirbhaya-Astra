import { CrimeDataPoint } from './types';

export async function loadCrimeData(): Promise<CrimeDataPoint[]> {
  try {
    const response = await fetch('/data/crime-data.json');
    if (!response.ok) {
      console.error('Failed to load crime data:', response.statusText);
      return [];
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading crime data:', error);
    return [];
  }
}