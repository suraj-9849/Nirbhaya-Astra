"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Shield, Sun, Moon, Route, MapPin } from "lucide-react";
import { SafeRouteMap } from "@/components/SafeRouteMap";
import LocationSearch from "@/components/LocationSearch";
import { DirectionsPanel } from "@/components/DirectionsPanel";
import { SafetyAnalysisPanel } from "@/components/SafetyAnalysisPanel";
import { ContextualSafety } from "@/components/ContextualSafety";
import { EmergencyAlert } from "@/components/EmergencyAlert";
import { SafetyAlert } from "@/types";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceCommand } from "@/components/VoiceCommand";
import { useMaps } from "@/app/contexts/MapsContext";
import { loadCrimeData } from '../lib/crime/utils';
import { CRIME_ANALYSIS_CONFIG } from '../lib/crime/constants';

// Update API base URL to match your Flask backend
const API_BASE_URL = "http://localhost:8081";

interface Location {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

interface SafetyAnalysis {
  safety_score: number;
  risk_level: string;
  primary_concerns: string[];
  recommendations: string[];
  safe_spots: string[];
  emergency_resources: string[];
  safer_alternatives?: string[];
  confidence_score: number;
  risks: string[];
  safe_spaces: string[];
}

interface RouteInfo {
  distance: string;
  duration: string;
  steps: google.maps.DirectionsStep[];
  safetyScore?: number;
  safetyGrade?: string;
  routeId: string;
  distanceValue: number;
  durationValue: number;
}

interface SafePlace {
  place_id: string;
  name: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  vicinity: string;
}

interface RouteWithSafety extends RouteInfo {
  route: google.maps.DirectionsResult;
  safetyScore: number;
  safetyGrade: string;
  safePlacesCount: number;
  safePlaces: SafePlace[];
  isRecommended: boolean;
  color: string;
  crimeRisk?: number;
}

interface RouteResponse {
  status: string;
  data?: {
    route_id: number;
    analysis: SafetyAnalysis;
    distance: number;
  };
  error?: string;
}

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface FromLocationProps {
  currentLocation: Location | null;
  locationStatus: "loading" | "denied" | "error" | "success";
  onLocationSelect: (location: Location) => void;
}

function FromLocationInput({
  currentLocation,
  locationStatus,
  onLocationSelect,
}: FromLocationProps) {
  return (
    <div>
      <label className="text-sm font-medium mb-2 block">From</label>
      <div className="space-y-2">
        <LocationSearch
          onLocationSelect={(location) =>
            onLocationSelect({
              ...location,
              timestamp: new Date(),
              lat: location.lat,
              lng: location.lng,
            })
          }
          placeholder="Enter starting location"
          initialValue={currentLocation?.address}
          showCurrentLocationButton={true}
          showFindRouteButton={false}
        />
        {locationStatus === "loading" && (
          <p className="text-sm text-muted-foreground">
            Getting your location...
          </p>
        )}
        {locationStatus === "denied" && (
          <p className="text-sm text-muted-foreground">
            Please enable location access
          </p>
        )}
      </div>
    </div>
  );
}

function RouteCard({ route, onSelect, isSelected }: {
  route: RouteWithSafety;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const getSafetyColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'D': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'F': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : 'hover:shadow-md'
      } ${route.isRecommended ? 'border-green-400' : ''}`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: route.color }}
            />
            <span className="font-semibold">Route {route.routeId}</span>
            {route.isRecommended && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                <Shield className="w-3 h-3 mr-1" />
                Recommended
              </Badge>
            )}
          </div>
          <Badge className={getSafetyColor(route.safetyGrade)}>
            Grade {route.safetyGrade}
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Distance:</span>
            <p className="font-medium">{route.distance}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Duration:</span>
            <p className="font-medium">{route.duration}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Safety Score:</span>
            <p className="font-medium">{route.safetyScore}/100</p>
          </div>
          <div>
            <span className="text-muted-foreground">Safe Places:</span>
            <p className="font-medium">{route.safePlacesCount}</p>
          </div>
        </div>
        
        {route.safePlaces.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground mb-1">Nearby Safe Places:</p>
            <div className="flex flex-wrap gap-1">
              {route.safePlaces.slice(0, 3).map((place) => (
                <Badge 
                  key={place.place_id} 
                  variant="outline" 
                  className="text-xs"
                >
                  {place.types.includes('police') ? '🚔' : '🏥'} {place.name.slice(0, 15)}...
                </Badge>
              ))}
              {route.safePlaces.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{route.safePlaces.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Crime data structure
interface CrimeDataPoint {
  lat: number;
  long: number;
  crimes: number; // Crime density score
}

// Preprocess crime data into spatial grid for efficient lookup
class CrimeGrid {
  private grid: Map<string, CrimeDataPoint[]>;
  private cellSize: number = 0.01; // ~1km grid cells
  
  constructor(crimeData: CrimeDataPoint[]) {
    this.grid = new Map();
    this.buildGrid(crimeData);
  }
  
  private buildGrid(crimeData: CrimeDataPoint[]) {
    crimeData.forEach(point => {
      const cellKey = this.getCellKey(point.lat, point.long);
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, []);
      }
      this.grid.get(cellKey)!.push(point);
    });
  }
  
  private getCellKey(lat: number, lng: number): string {
    const gridLat = Math.floor(lat / this.cellSize);
    const gridLng = Math.floor(lng / this.cellSize);
    return `${gridLat},${gridLng}`;
  }

  // Get points within a certain radius (in degrees) from a given location
  public getPointsInRadius(lat: number, lng: number, radius: number): CrimeDataPoint[] {
    const centerCell = this.getCellKey(lat, lng);
    const results: CrimeDataPoint[] = [];
    
    // Check surrounding cells within the radius
    for (let dLat = -radius; dLat <= radius; dLat += this.cellSize) {
      for (let dLng = -radius; dLng <= radius; dLng += this.cellSize) {
        const cellKey = this.getCellKey(lat + dLat, lng + dLng);
        const pointsInCell = this.grid.get(cellKey);
        
        if (pointsInCell) {
          results.push(...pointsInCell);
        }
      }
    }
    
    return results;
  }
}

// Calculate crime risk for a specific location
function calculateCrimeRisk(lat: number, lng: number, crimeGrid: CrimeGrid): number {
  const radius = 0.005; // ~500m radius
  const nearbyPoints = crimeGrid.getPointsInRadius(lat, lng, radius);
  
  if (nearbyPoints.length === 0) return 0;
  
  // Weighted average based on distance
  let totalWeight = 0;
  let weightedCrimeSum = 0;
  
  nearbyPoints.forEach(point => {
    const distance = calculateDistance(lat, lng, point.lat, point.long);
    const weight = Math.exp(-distance * 10); // Exponential decay
    
    totalWeight += weight;
    weightedCrimeSum += point.crimes * weight;
  });
  
  return totalWeight > 0 ? weightedCrimeSum / totalWeight : 0;
}

// Haversine distance formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Calculate safety score for an entire route
function calculateRouteSafetyScore(route: google.maps.DirectionsResult, crimeGrid: CrimeGrid): number {
  const path = route.routes[0].overview_path;
  let totalCrimeRisk = 0;
  let sampleCount = 0;
  
  // Sample points along the route (every 100m approximately)
  const sampleInterval = Math.max(1, Math.floor(path.length / 50));
  
  for (let i = 0; i < path.length; i += sampleInterval) {
    const point = path[i];
    const crimeRisk = calculateCrimeRisk(point.lat(), point.lng(), crimeGrid);
    totalCrimeRisk += crimeRisk;
    sampleCount++;
  }
  
  const averageCrimeRisk = sampleCount > 0 ? totalCrimeRisk / sampleCount : 0;
  
  // Convert to safety score (0-100, where 100 is safest)
  // Assuming crime scores range from 0-2 (adjust based on your data)
  const maxCrimeScore = 2.0;
  const safetyScore = Math.max(0, 100 - (averageCrimeRisk / maxCrimeScore) * 100);
  
  return Math.round(safetyScore);
}

// Identify high-crime segments along a route
function identifyHighRiskSegments(
  route: google.maps.DirectionsResult, 
  crimeGrid: CrimeGrid,
  threshold: number = 1.0
): HighRiskSegment[] {
  const path = route.routes[0].overview_path;
  const highRiskSegments: HighRiskSegment[] = [];
  let currentSegment: HighRiskSegment | null = null;
  
  for (let i = 0; i < path.length; i++) {
    const point = path[i];
    const crimeRisk = calculateCrimeRisk(point.lat(), point.lng(), crimeGrid);
    
    if (crimeRisk > threshold) {
      if (!currentSegment) {
        currentSegment = {
          startIndex: i,
          endIndex: i,
          maxRisk: crimeRisk,
          avgRisk: crimeRisk,
          riskPoints: 1
        };
      } else {
        currentSegment.endIndex = i;
        currentSegment.maxRisk = Math.max(currentSegment.maxRisk, crimeRisk);
        currentSegment.avgRisk = (currentSegment.avgRisk * currentSegment.riskPoints + crimeRisk) / (currentSegment.riskPoints + 1);
        currentSegment.riskPoints++;
      }
    } else {
      if (currentSegment) {
        highRiskSegments.push(currentSegment);
        currentSegment = null;
      }
    }
  }
  
  if (currentSegment) {
    highRiskSegments.push(currentSegment);
  }
  
  return highRiskSegments;
}

interface HighRiskSegment {
  startIndex: number;
  endIndex: number;
  maxRisk: number;
  avgRisk: number;
  riskPoints: number;
}

export default function SafeRoutePage() {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyAnalysis, setSafetyAnalysis] = useState<SafetyAnalysis | null>(null);
  const [routes, setRoutes] = useState<RouteWithSafety[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteWithSafety | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "loading" | "denied" | "error" | "success"
  >("loading");
  const [isInitializing, setIsInitializing] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  const [startLocation, setStartLocation] = useState<Location | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { isLoaded, loadError } = useMaps();
  const [crimeData, setCrimeData] = useState<CrimeDataPoint[]>([]);

  const locationOptions = {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsInitializing(false);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const requestLocationPermission = async () => {
      try {
        const result = await navigator.permissions.query({
          name: "geolocation",
        });
        if (result.state === "denied") {
          setLocationError(
            "Location access is denied. Please enable it in your browser settings.",
          );
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date(position.timestamp),
            });
            setLocationError(null);
          },
          (error) => {
            console.error("Geolocation error:", error);
            setLocationError(
              "Unable to get your location. Please enable location services.",
            );
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          },
        );
      } catch (error) {
        console.error("Permission error:", error);
        setLocationError("Location permission error");
      }
    };

    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    if ("geolocation" in navigator) {
      if (typeof google === "undefined") {
        console.error("Google Maps API not loaded");
        setLocationStatus("error");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const geocoder = new google.maps.Geocoder();
          const latlng = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };

          try {
            const result = await new Promise<google.maps.GeocoderResult>(
              (resolve, reject) => {
                geocoder.geocode({ location: latlng }, (results, status) => {
                  if (
                    status === google.maps.GeocoderStatus.OK &&
                    results?.[0]
                  ) {
                    resolve(results[0]);
                  } else {
                    reject(new Error("Geocoding failed"));
                  }
                });
              },
            );

            const newLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: result.formatted_address,
              timestamp: new Date(),
            };
            setCurrentLocation(newLocation);
            setStartLocation(newLocation);
            setLocationStatus("success");
          } catch (error) {
            console.error("Geocoding error:", error);
            setLocationStatus("error");
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationStatus("denied");
          setError("Please enable location services to use route planning.");
        },
        locationOptions,
      );
    }
  }, [isLoaded]);

  const findSafePlacesNearRoute = async (route: google.maps.DirectionsResult): Promise<SafePlace[]> => {
    if (!route.routes?.[0]?.overview_path) return [];

    const path = route.routes[0].overview_path;
    const safePlaces: SafePlace[] = [];
    const processedPlaceIds = new Set<string>();

    // Sample points along the route (every 10th point for efficiency)
    const samplePoints = path.filter((_, index) => index % 10 === 0);

    for (const point of samplePoints) {
      try {
        const service = new google.maps.places.PlacesService(document.createElement('div'));
        
        const request: google.maps.places.PlaceSearchRequest = {
          location: point,
          radius: 300, // 300m radius as specified in algorithm
          type: 'police'
        };

        const policeResults = await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
          service.nearbySearch(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              resolve([]);
            }
          });
        });

        const hospitalRequest: google.maps.places.PlaceSearchRequest = {
          location: point,
          radius: 300,
          type: 'hospital'
        };

        const hospitalResults = await new Promise<google.maps.places.PlaceResult[]>((resolve) => {
          service.nearbySearch(hospitalRequest, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results) {
              resolve(results);
            } else {
              resolve([]);
            }
          });
        });

        // Process police stations
        policeResults.forEach(place => {
          if (place.place_id && !processedPlaceIds.has(place.place_id) && place.geometry?.location) {
            processedPlaceIds.add(place.place_id);
            safePlaces.push({
              place_id: place.place_id,
              name: place.name || 'Police Station',
              location: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              },
              types: place.types || ['police'],
              rating: place.rating,
              vicinity: place.vicinity || ''
            });
          }
        });

        // Process hospitals
        hospitalResults.forEach(place => {
          if (place.place_id && !processedPlaceIds.has(place.place_id) && place.geometry?.location) {
            processedPlaceIds.add(place.place_id);
            safePlaces.push({
              place_id: place.place_id,
              name: place.name || 'Hospital',
              location: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
              },
              types: place.types || ['hospital'],
              rating: place.rating,
              vicinity: place.vicinity || ''
            });
          }
        });

      } catch (error) {
        console.error('Error finding safe places:', error);
      }
    }

    return safePlaces;
  };

  const calculateSafetyScore = (safePlaces: SafePlace[]): number => {
    let score = 0;
    
    safePlaces.forEach(place => {
      if (place.types.includes('police')) {
        score += 10; // +10 for police stations
      } else if (place.types.includes('hospital')) {
        score += 7; // +7 for hospitals
      }
    });

    // Normalize to 0-100 scale (assuming max realistic score of 200)
    return Math.min(100, (score / 2));
  };

  const getSafetyGrade = (score: number): string => {
    if (score >= 80) return 'A';
    if (score >= 60) return 'B';
    if (score >= 40) return 'C';
    if (score >= 20) return 'D';
    return 'F';
  };

  // Original route generation without crime data - rename this from what was previously generateMultipleRoutes
  async function generateMultipleRoutesOriginal(start: Location, end: Location): Promise<RouteWithSafety[]> {
    if (!google?.maps) return [];

    const directionsService = new google.maps.DirectionsService();
    
    const request: google.maps.DirectionsRequest = {
      origin: { lat: start.lat, lng: start.lng },
      destination: { lat: end.lat, lng: end.lng },
      travelMode: google.maps.TravelMode.DRIVING,
      avoidHighways: false,
      avoidTolls: false,
      provideRouteAlternatives: true
    };

    try {
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      if (!result.routes?.length) return [];

      const routesWithSafety: RouteWithSafety[] = [];
      const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04'];
      
      for (let i = 0; i < Math.min(result.routes.length, 3); i++) {
        const route = result.routes[i];
        const leg = route.legs?.[0];
        
        if (leg) {
          const safePlaces = await findSafePlacesNearRoute({ ...result, routes: [route] });
          const safetyScore = calculateSafetyScore(safePlaces);
          const safetyGrade = getSafetyGrade(safetyScore);
 
          routesWithSafety.push({
            routeId: `${i + 1}`,
            distance: leg.distance?.text || '',
            duration: leg.duration?.text || '',
            distanceValue: leg.distance?.value || 0,
            durationValue: leg.duration?.value || 0,
            steps: leg.steps || [],
            route: { ...result, routes: [route] },
            safetyScore,
            safetyGrade,
            safePlacesCount: safePlaces.length,
            safePlaces,
            isRecommended: false,
            color: colors[i] || '#6b7280'
          });
        }
      }

      routesWithSafety.sort((a, b) => b.safetyScore - a.safetyScore);
      if (routesWithSafety.length > 0) {
        routesWithSafety[0].isRecommended = true;
      }

      return routesWithSafety;
    } catch (error) {
      console.error('Error generating routes:', error);
      return [];
    }
  }

  // Then update your generateMultipleRoutes function to avoid recursion:
  const generateMultipleRoutes = async (
    start: Location, 
    end: Location,
    crimeData?: CrimeDataPoint[]
  ): Promise<RouteWithSafety[]> => {
    
    // Initialize crime grid if data is available
    const crimeGrid = crimeData ? new CrimeGrid(crimeData) : null;
    
    if (crimeGrid) {
      // Use crime-aware routing
      return await generateCrimeAwareRoutes(start, end, crimeGrid);
    } else {
      // Fallback to existing logic without crime data
      return await generateMultipleRoutesOriginal(start, end);
    }
  };

  // Enhanced safety analysis
  const analyzeSafetyForRoute = async (
    start: Location,
    end: Location,
    route: RouteWithSafety,
    crimeData?: CrimeDataPoint[]
  ): Promise<SafetyAnalysis | null> => {
    try {
      // Call the original backend API - CHANGE THE ENDPOINT HERE TO MATCH THE FLASK ROUTE
      const response = await fetch(`${API_BASE_URL}/analyze-route`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_location: {
            lat: start.lat,
            lng: start.lng,
            address: start.address || '',
          },
          end_location: {
            lat: end.lat,
            lng: end.lng,
            address: end.address || '',
          },
          route: {
            distance: route.distanceValue,
            duration: route.durationValue,
            steps: route.steps.map(step => ({
              distance: step.distance?.value || 0,
              duration: step.duration?.value || 0,
              instructions: step.instructions || '',
              start_location: {
                lat: step.start_location.lat(),
                lng: step.start_location.lng()
              },
              end_location: {
                lat: step.end_location.lat(),
                lng: step.end_location.lng()
              }
            }))
          },
          time_of_day: new Date().getHours() >= 18 || new Date().getHours() < 6 ? 'night' : 'day',
          current_weather: 'clear', // This could be fetched from a weather API
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: RouteResponse = await response.json();
      
      if (data.status === 'success' && data.data) {
        // Get the base analysis from the backend
        const baseAnalysis = data.data.analysis;
        
        // Enhance with crime data if available
        if (crimeData && crimeData.length > 0) {
          const crimeGrid = new CrimeGrid(crimeData);
          const crimeRisk = 100 - calculateRouteSafetyScore(route.route, crimeGrid);
          
          // Combine backend analysis with crime data
          return {
            ...baseAnalysis,
            safety_score: Math.round((baseAnalysis.safety_score + (100 - crimeRisk)) / 2),
            primary_concerns: [
              ...baseAnalysis.primary_concerns,
              ...(crimeRisk > 30 ? ['High crime activity areas along route'] : [])
            ],
            recommendations: [
              ...baseAnalysis.recommendations,
              ...(crimeRisk > 50 ? ['Consider alternative route with lower crime rates'] : []),
              ...(crimeRisk > 30 ? ['Stay alert in marked high-risk areas'] : [])
            ]
          };
        }
        
        return baseAnalysis;
      } else {
        console.error('API returned error:', data.error);
        // Fallback to local safety calculation if API fails
        return {
          safety_score: route.safetyScore,
          risk_level: route.safetyGrade === 'A' ? 'Low' : 
                      route.safetyGrade === 'B' ? 'Low-Medium' : 
                      route.safetyGrade === 'C' ? 'Medium' : 
                      route.safetyGrade === 'D' ? 'Medium-High' : 'High',
          primary_concerns: [],
          recommendations: [],
          safe_spots: [],
          emergency_resources: [],
          safer_alternatives: [],
          confidence_score: 70,
          risks: [],
          safe_spaces: [],
        };
      }
    } catch (error) {
      console.error('Error analyzing route safety:', error);
      // Fallback to local safety calculation
      return {
        safety_score: route.safetyScore,
        risk_level: route.safetyGrade === 'A' ? 'Low' : 
                    route.safetyGrade === 'B' ? 'Low-Medium' : 
                    route.safetyGrade === 'C' ? 'Medium' : 
                    route.safetyGrade === 'D' ? 'Medium-High' : 'High',
        primary_concerns: [],
        recommendations: [],
        safe_spots: [],
        emergency_resources: [],
        safer_alternatives: [],
        confidence_score: 70,
        risks: [],
        safe_spaces: [],
      };
    }
  };

  const handleLocationSelect = async (
    location: Omit<Location, "timestamp">,
  ) => {
    if (!currentLocation) return;

    const locationWithTimestamp: Location = {
      ...location,
      timestamp: new Date(),
    };

    setLoading(true);
    setError(null);
    setDestination(locationWithTimestamp);
    setRoutes([]);
    setSelectedRoute(null);

    try {
      setIsAnalyzing(true);
      
      // Pass crimeData to generateMultipleRoutes
      const generatedRoutes = await generateMultipleRoutes(
        currentLocation, 
        locationWithTimestamp,
        crimeData.length > 0 ? crimeData : undefined
      );
      
      if (generatedRoutes.length > 0) {
        setRoutes(generatedRoutes);
        setSelectedRoute(generatedRoutes[0]); // Select the recommended route by default
        
        // Analyze safety for the recommended route
        const analysis = await analyzeSafetyForRoute(
          currentLocation,
          locationWithTimestamp,
          generatedRoutes[0],
        );
        
        if (analysis) {
          setSafetyAnalysis(analysis);
        }
      }
    } catch (err) {
      console.error("🔴 Route analysis error:", err);
      setError(err instanceof Error ? err.message : "Failed to analyze route");
    } finally {
      setLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleRouteSelect = async (route: RouteWithSafety) => {
    setSelectedRoute(route);
    
    if (currentLocation && destination) {
      setIsAnalyzing(true);
      const analysis = await analyzeSafetyForRoute(
        currentLocation, 
        destination, 
        route,
        crimeData.length > 0 ? crimeData : undefined
      );
      if (analysis) {
        setSafetyAnalysis(analysis);
      }
      setIsAnalyzing(false);
    }
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? "day" : "night";
  };

  const requestLocationPermission = async () => {
    try {
      const result = await navigator.permissions.query({
        name: "geolocation" as PermissionName,
      });
      if (result.state === "prompt") {
        navigator.geolocation.getCurrentPosition(
          () => {},
          () => {},
        );
      }
    } catch (error) {
      console.error("Permission check failed:", error);
    }
  };

  const retryLocationRequest = () => {
    if (retryCount < maxRetries) {
      setRetryCount((prev) => prev + 1);
      setLocationStatus("loading");
      requestLocationPermission();
    }
  };

  const handleStartLocationSelect = (location: Location) => {
    setStartLocation(location);
  };

  // Modified route generation with crime awareness
  async function generateCrimeAwareRoutes(
    start: Location, 
    end: Location, 
    crimeGrid: CrimeGrid
  ): Promise<RouteWithSafety[]> {
    if (!google?.maps) return [];
    
    const directionsService = new google.maps.DirectionsService();
    
    // Generate multiple route options with different parameters
    const routeRequests = [
      { // Standard route
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false,
        provideRouteAlternatives: true
      },
      { // Avoid highways (often safer, well-lit routes)
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: true,
        avoidTolls: false
      },
      { // Walking route (for short distances)
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: google.maps.TravelMode.WALKING
      }
    ];
    
    const routes: RouteWithSafety[] = [];
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#ca8a04'];
    
    // Store path signatures to check for duplicate routes
    const routeSignatures = new Set<string>();
    
    for (let i = 0; i < routeRequests.length; i++) {
      try {
        const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
          directionsService.route(routeRequests[i], (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              resolve(result);
            } else {
              reject(new Error(`Route ${i + 1} failed: ${status}`));
            }
          });
        });
        
        if (result.routes?.length) {
          // For the first request, which has alternatives, process all routes
          const routesToProcess = i === 0 ? result.routes : [result.routes[0]];
          
          for (const route of routesToProcess) {
            const leg = route.legs?.[0];
            
            if (leg) {
              // Create a signature for this route to detect duplicates
              const path = route.overview_path || [];
              const pathSample = path.filter((_, idx) => idx % 5 === 0).map(p => `${p.lat().toFixed(4)},${p.lng().toFixed(4)}`).join('|');
              
              // Skip if we've already seen a very similar route
              if (routeSignatures.has(pathSample)) continue;
              routeSignatures.add(pathSample);
              
              // Calculate crime-based safety score
              const crimeSafetyScore = calculateRouteSafetyScore(
                { ...result, routes: [route] }, 
                crimeGrid
              );
              
              // Find safe places along route
              const safePlaces = await findSafePlacesNearRoute({ ...result, routes: [route] });
              const safePlaceScore = calculateSafetyScore(safePlaces);
              
              // Combined safety score (70% crime data, 30% safe places)
              const combinedSafetyScore = Math.round(
                (crimeSafetyScore * 0.7) + (safePlaceScore * 0.3)
              );
              
              // Get travel mode description
              let routeDescription = '';
              if (routeRequests[i].travelMode === google.maps.TravelMode.WALKING) {
                routeDescription = ' (Walking)';
              } else if (routeRequests[i].avoidHighways) {
                routeDescription = ' (No Highways)';
              }
              
              routes.push({
                routeId: `${routes.length + 1}${routeDescription}`,
                distance: leg.distance?.text || '',
                duration: leg.duration?.text || '',
                distanceValue: leg.distance?.value || 0,
                durationValue: leg.duration?.value || 0,
                steps: leg.steps || [],
                route: { ...result, routes: [route] },
                safetyScore: combinedSafetyScore,
                safetyGrade: getSafetyGrade(combinedSafetyScore),
                safePlacesCount: safePlaces.length,
                safePlaces,
                isRecommended: false,
                color: colors[routes.length % colors.length] || '#6b7280',
                crimeRisk: 100 - crimeSafetyScore // Additional property for crime risk
              });
              
              // Limit to 3 routes for UI simplicity
              if (routes.length >= 3) break;
            }
          }
        }
        
        // If we already have 3 routes, stop processing
        if (routes.length >= 3) break;
        
      } catch (error) {
        console.error(`Error generating route ${i + 1}:`, error);
      }
    }
    
    // Sort by combined safety score and mark the safest as recommended
    routes.sort((a, b) => b.safetyScore - a.safetyScore);
    if (routes.length > 0) {
      routes[0].isRecommended = true;
    }
    
    return routes;
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Google Maps API key is required. Please add it to your environment
          variables.
        </AlertDescription>
      </Alert>
    );
  }

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">
            Initializing location services...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Plan Safe Route</h1>
          <p className="text-muted-foreground mt-1">
            Find the safest path to your destination
          </p>
        </div>

        <div className="flex items-center gap-4">
          <VoiceCommand />
          <Badge
            variant={getTimeOfDay() === "day" ? "default" : "secondary"}
            className="px-4 py-1 text-sm"
          >
            {getTimeOfDay() === "day" ? (
              <Sun className="h-4 w-4 mr-2" />
            ) : (
              <Moon className="h-4 w-4 mr-2" />
            )}
            {getTimeOfDay() === "day" ? "Daytime Route" : "Nighttime Route"}
          </Badge>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <Card className="shadow-lg">
        <CardContent className="pt-6 space-y-4">
          <FromLocationInput
            currentLocation={currentLocation}
            locationStatus={locationStatus}
            onLocationSelect={handleStartLocationSelect}
          />

          {/* To Location */}
          <div>
            <label className="text-sm font-medium mb-2 block">To</label>
            <LocationSearch
              onLocationSelect={handleLocationSelect}
              loading={loading}
              disabled={!startLocation}
              placeholder="Where do you want to go?"
              showFindRouteButton={true}
            />
          </div>

          {/* Existing status messages */}
          {locationStatus === "denied" && (
            <p className="text-sm text-muted-foreground">
              Please enable location access in your browser settings to use
              route planning
            </p>
          )}
          {locationStatus === "error" && (
            <Button onClick={retryLocationRequest} variant="outline" size="sm">
              Retry Location Request
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Route Options */}
      {routes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Route Options</h2>
            <Badge variant="secondary">{routes.length} routes found</Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map((route) => (
              <RouteCard
                key={route.routeId}
                route={route}
                onSelect={() => handleRouteSelect(route)}
                isSelected={selectedRoute?.routeId === route.routeId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Contextual Safety */}
      {destination && <ContextualSafety location={destination} />}

      {/* Main Content */}
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="map">Map View</TabsTrigger>
          <TabsTrigger value="turn-by-turn">Turn-by-Turn</TabsTrigger>
          <TabsTrigger value="safety">Safety Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <Card className="overflow-hidden shadow-lg">
            <CardContent className="p-0 relative" style={{ height: "600px" }}>
              <div className="absolute inset-0">
                {currentLocation && (
                  <SafeRouteMap
                    initialLocation={{
                      lat: currentLocation.lat,
                      lng: currentLocation.lng,
                    }}
                    fromLocation={
                      startLocation
                        ? `${startLocation.lat},${startLocation.lng}`
                        : ""
                    }
                    toLocation={
                      destination ? `${destination.lat},${destination.lng}` : ""
                    }
                    onRouteCalculated={(route) => {
                      // Handle route calculated if needed
                      console.log('Route calculated:', route);
                    }}
                  />
                )}
              </div>
              
              {/* Route Legend */}
              {routes.length > 0 && (
                <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-md">
                  <h4 className="font-semibold text-sm mb-2">Route Legend</h4>
                  <div className="space-y-1">
                    {routes.map((route) => (
                      <div key={route.routeId} className="flex items-center gap-2 text-xs">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: route.color }}
                        />
                        <span>Route {route.routeId}</span>
                        <Badge 
                          variant="outline" 
                          className="text-xs px-1 py-0"
                        >
                          {route.safetyGrade}
                        </Badge>
                        {route.isRecommended && (
                          <Shield className="w-3 h-3 text-green-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading Overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="bg-white p-4 rounded-lg flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Analyzing route safety...</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="turn-by-turn">
          <DirectionsPanel
            destination={destination}
            routeInfo={selectedRoute || null}
            safetyScore={selectedRoute?.safetyScore}
          />
        </TabsContent>

        <TabsContent value="safety">
          <div className="space-y-6">
            {/* Route Comparison */}
            {routes.length > 1 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Route Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Route</th>
                          <th className="text-left py-2">Safety Grade</th>
                          <th className="text-left py-2">Safe Places</th>
                          <th className="text-left py-2">Distance</th>
                          <th className="text-left py-2">Duration</th>
                          <th className="text-left py-2">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {routes.map((route) => (
                          <tr 
                            key={route.routeId} 
                            className={`border-b cursor-pointer hover:bg-gray-50 ${
                              selectedRoute?.routeId === route.routeId ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => handleRouteSelect(route)}
                          >
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: route.color }}
                                />
                                Route {route.routeId}
                              </div>
                            </td>
                            <td className="py-2">
                              <Badge 
                                className={`${
                                  route.safetyGrade === 'A' ? 'bg-green-100 text-green-800' :
                                  route.safetyGrade === 'B' ? 'bg-blue-100 text-blue-800' :
                                  route.safetyGrade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                                  route.safetyGrade === 'D' ? 'bg-orange-100 text-orange-800' :
                                  'bg-red-100 text-red-800'
                                }`}
                              >
                                {route.safetyGrade} ({route.safetyScore}/100)
                              </Badge>
                            </td>
                            <td className="py-2">{route.safePlacesCount}</td>
                            <td className="py-2">{route.distance}</td>
                            <td className="py-2">{route.duration}</td>
                            <td className="py-2">
                              {route.isRecommended && (
                                <Badge variant="default" className="bg-green-100 text-green-800">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Recommended
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Route Safety Analysis */}
            <SafetyAnalysisPanel
              safetyAnalysis={safetyAnalysis}
              routeInfo={selectedRoute || null}
            />

            {/* Safe Places Detail */}
            {selectedRoute && selectedRoute.safePlaces.length > 0 && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold mb-4">Safe Places Along Route</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedRoute.safePlaces.map((place) => (
                      <div key={place.place_id} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <div className="text-2xl">
                            {place.types.includes('police') ? '🚔' : '🏥'}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{place.name}</h4>
                            <p className="text-sm text-muted-foreground">{place.vicinity}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {place.types.includes('police') ? 'Police Station' : 'Hospital'}
                              </Badge>
                              {place.rating && (
                                <span className="text-xs text-muted-foreground">
                                  ⭐ {place.rating}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Emergency Alert */}
      {currentLocation && (
        <EmergencyAlert
          currentLocation={{
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            address: currentLocation.address || "",
            timestamp: new Date(),
          }}
          onAlertSent={(alert: SafetyAlert) => {
            console.log("Emergency alert sent:", alert);
          }}
        />
      )}
    </div>
  );
}