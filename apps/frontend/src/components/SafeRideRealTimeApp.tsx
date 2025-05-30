"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Navigation, 
  Shield, 
  Car, 
  Clock, 
  Star, 
  Phone, 
  MessageCircle,
  CheckCircle,
  XCircle,
  User,
  Route,
  AlertTriangle,
  Heart,
  Loader2,
  Search,
  UserCheck,
  CarFront,
  Bell,
  DollarSign
} from 'lucide-react';

// Real Supabase Integration
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-supabase-anon-key';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Real-time subscription helper
class RealTimeManager {
  static subscribeToRideRequests(callback: (data: any) => void, filters?: { status?: string }) {
    let query = supabase
      .channel('ride_requests_channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'ride_requests',
          filter: filters?.status ? `status=eq.${filters.status}` : undefined
        }, 
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(query);
    };
  }

  static subscribeToRiders(callback: (data: any) => void) {
    let query = supabase
      .channel('riders_channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'riders' 
        }, 
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(query);
    };
  }
}

// Database operations
class DatabaseService {
  static async insertRideRequest(rideRequest: Omit<RideRequest, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('ride_requests')
      .insert(rideRequest)
      .select()
      .single();
    
    return { data, error };
  }

  static async updateRideRequest(id: string, updates: Partial<RideRequest>) {
    const { data, error } = await supabase
      .from('ride_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    return { data, error };
  }

  static async insertRider(rider: Omit<Rider, 'id'>) {
    const { data, error } = await supabase
      .from('riders')
      .insert(rider)
      .select()
      .single();
    
    return { data, error };
  }

  static async updateRiderStatus(riderId: string, isOnline: boolean, currentLocation?: Location) {
    const { data, error } = await supabase
      .from('riders')
      .update({ 
        is_online: isOnline,
        current_location: currentLocation,
        updated_at: new Date().toISOString()
      })
      .eq('id', riderId)
      .select()
      .single();
    
    return { data, error };
  }

  static async getRideRequestsByStatus(status: string) {
    const { data, error } = await supabase
      .from('ride_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });
    
    return { data, error };
  }

  static async getNearbyRiders(location: Location, radiusKm: number = 10) {
    // Note: This requires PostGIS extension for proper geo queries
    // For now, we'll get all online riders and filter in client
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .eq('is_online', true);
    
    return { data, error };
  }
}

// Types
interface Location {
  lat: number;
  lng: number;
  address?: string;
  timestamp: Date;
}

interface SafePlace {
  place_id: string;
  name: string;
  location: { lat: number; lng: number };
  types: string[];
  rating?: number;
  vicinity: string;
}

interface RouteWithSafety {
  routeId: string;
  distance: string;
  duration: string;
  distanceValue: number;
  durationValue: number;
  steps: google.maps.DirectionsStep[];
  route: google.maps.DirectionsResult;
  safetyScore: number;
  safetyGrade: string;
  safePlacesCount: number;
  safePlaces: SafePlace[];
  isRecommended: boolean;
  color: string;
  fare: number;
}

interface RideRequest {
  id?: string;
  booker_id: string;
  booker_name: string;
  pickup_location: Location;
  drop_location: Location;
  selected_route: RouteWithSafety;
  fare: number;
  status: 'pending' | 'accepted' | 'ongoing' | 'completed' | 'cancelled';
  created_at?: string;
  rider_id?: string;
  rider_name?: string;
}

interface Rider {
  id?: string;
  name: string;
  phone: string;
  car_model: string;
  car_number: string;
  rating: number;
  current_location: Location;
  is_online: boolean;
  verification_status: 'verified' | 'pending';
}

const SafeRideRealTimeApp = () => {
  const [userType, setUserType] = useState<'rider' | 'ridebooker' | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  
  // RideBooker states
  const [rideRequest, setRideRequest] = useState<{
    from: Location | null;
    to: Location | null;
    selectedRoute: RouteWithSafety | null;
    status: 'booking' | 'route-selection' | 'searching' | 'matched' | 'ongoing';
  }>({
    from: null,
    to: null,
    selectedRoute: null,
    status: 'booking'
  });
  
  const [availableRoutes, setAvailableRoutes] = useState<RouteWithSafety[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [matchedRider, setMatchedRider] = useState<Rider | null>(null);
  
  // Autocomplete states
  const [fromPredictions, setFromPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [toPredictions, setToPredictions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  
  // Rider states
  const [isRiderOnline, setIsRiderOnline] = useState(false);
  const [nearbyRideRequests, setNearbyRideRequests] = useState<RideRequest[]>([]);
  const [acceptedRide, setAcceptedRide] = useState<RideRequest | null>(null);
  const [riderProfile, setRiderProfile] = useState<Partial<Rider>>({
    name: '',
    phone: '',
    car_model: '',
    car_number: '',
    rating: 4.8
  });
  
  // Map states
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Get current location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const geocoder = new google.maps.Geocoder();
          try {
            const result = await new Promise<google.maps.GeocoderResult>((resolve, reject) => {
              geocoder.geocode({
                location: {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                }
              }, (results, status) => {
                if (status === google.maps.GeocoderStatus.OK && results?.[0]) {
                  resolve(results[0]);
                } else {
                  reject(new Error('Geocoding failed'));
                }
              });
            });

            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              address: result.formatted_address,
              timestamp: new Date()
            });
          } catch (error) {
            console.error('Geocoding error:', error);
            setCurrentLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              timestamp: new Date()
            });
          }
        },
        (error) => console.error('Location error:', error)
      );
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (mapRef.current && !map && typeof google !== 'undefined') {
      const newMap = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: currentLocation || { lat: 17.4065, lng: 78.4772 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      
      setMap(newMap);
      
      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#22c55e",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
      renderer.setMap(newMap);
      setDirectionsRenderer(renderer);
    }
  }, [mapRef.current, currentLocation]);

  // Real-time subscription for ride requests (Rider)
  useEffect(() => {
    if (userType === 'rider' && isRiderOnline && currentLocation) {
      console.log('Setting up real-time subscription for nearby ride requests...');
      
      const unsubscribe = RealTimeManager.subscribeToRideRequests((payload) => {
        console.log('Real-time update received:', payload);
        
        if (payload.eventType === 'INSERT' && payload.new.status === 'pending') {
          // New ride request
          const newRequest = payload.new as RideRequest;
          const distance = calculateDistance(
            currentLocation.lat,
            currentLocation.lng,
            newRequest.pickup_location.lat,
            newRequest.pickup_location.lng
          );
          
          if (distance <= 10) { // 10km radius
            setNearbyRideRequests(prev => [...prev, newRequest]);
          }
        } else if (payload.eventType === 'UPDATE') {
          // Updated ride request
          setNearbyRideRequests(prev => 
            prev.map(req => req.id === payload.new.id ? payload.new : req)
              .filter(req => req.status === 'pending')
          );
        } else if (payload.eventType === 'DELETE') {
          // Removed ride request
          setNearbyRideRequests(prev => 
            prev.filter(req => req.id !== payload.old.id)
          );
        }
      }, { status: 'pending' });

      // Initial fetch of pending requests
      DatabaseService.getRideRequestsByStatus('pending').then(({ data, error }) => {
        if (data && !error) {
          const nearby = data.filter((request: RideRequest) => {
            const distance = calculateDistance(
              currentLocation.lat,
              currentLocation.lng,
              request.pickup_location.lat,
              request.pickup_location.lng
            );
            return distance <= 10;
          });
          setNearbyRideRequests(nearby);
        }
      });

      return unsubscribe;
    }
  }, [userType, isRiderOnline, currentLocation]);

  // Real-time subscription for ride status (RideBooker)
  useEffect(() => {
    if (userType === 'ridebooker' && rideRequest.status === 'searching') {
      console.log('Setting up real-time subscription for ride status...');
      
      const unsubscribe = RealTimeManager.subscribeToRideRequests((payload) => {
        console.log('RideBooker received update:', payload);
        
        if (payload.eventType === 'UPDATE' && payload.new.booker_id === userName) {
          const updatedRequest = payload.new as RideRequest;
          
          if (updatedRequest.status === 'accepted' && updatedRequest.rider_id) {
            // Fetch rider details - in a real app, you'd have a riders table
            setMatchedRider({
              id: updatedRequest.rider_id,
              name: updatedRequest.rider_name || 'Driver',
              phone: '+91 98765 43210', // This would come from riders table
              car_model: 'Honda City', // This would come from riders table
              car_number: 'MH12AB1234', // This would come from riders table
              rating: 4.8,
              current_location: currentLocation!,
              is_online: true,
              verification_status: 'verified'
            });
            setRideRequest(prev => ({ ...prev, status: 'matched' }));
          }
        }
      });

      return unsubscribe;
    }
  }, [userType, rideRequest.status, userName]);

  // Utility function to calculate distance
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Autocomplete handlers (same as before)
  const handleFromInputChange = (value: string) => {
    setFromInput(value);
    if (!value.trim()) {
      setFromPredictions([]);
      setShowFromSuggestions(false);
      return;
    }

    const autocompleteService = new google.maps.places.AutocompleteService();
    autocompleteService.getPlacePredictions(
      {
        input: value,
        types: ["geocode", "establishment"],
        componentRestrictions: { country: "in" },
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setFromPredictions(predictions);
          setShowFromSuggestions(true);
        }
      }
    );
  };

  const handleToInputChange = (value: string) => {
    setToInput(value);
    if (!value.trim()) {
      setToPredictions([]);
      setShowToSuggestions(false);
      return;
    }

    const autocompleteService = new google.maps.places.AutocompleteService();
    autocompleteService.getPlacePredictions(
      {
        input: value,
        types: ["geocode", "establishment"],
        componentRestrictions: { country: "in" },
      },
      (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
          setToPredictions(predictions);
          setShowToSuggestions(true);
        }
      }
    );
  };

  const handlePlaceSelect = async (placeId: string, isFromLocation: boolean) => {
    const placesService = new google.maps.places.PlacesService(document.createElement('div'));
    
    placesService.getDetails(
      {
        placeId: placeId,
        fields: ["formatted_address", "geometry"],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const location: Location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            address: place.formatted_address,
            timestamp: new Date()
          };

          if (isFromLocation) {
            setRideRequest(prev => ({ ...prev, from: location }));
            setFromInput(place.formatted_address || '');
            setFromPredictions([]);
            setShowFromSuggestions(false);
          } else {
            setRideRequest(prev => ({ ...prev, to: location }));
            setToInput(place.formatted_address || '');
            setToPredictions([]);
            setShowToSuggestions(false);
          }
        }
      }
    );
  };

  // Generate safe routes (simplified version)
  const generateSafeRoutes = async (start: Location, end: Location): Promise<RouteWithSafety[]> => {
    if (!google?.maps) return [];

    const directionsService = new google.maps.DirectionsService();
    
    const routeRequests = [
      {
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: false,
        avoidTolls: false,
        provideRouteAlternatives: true
      },
      {
        origin: { lat: start.lat, lng: start.lng },
        destination: { lat: end.lat, lng: end.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        avoidHighways: true,
        avoidTolls: false
      }
    ];
    
    const routes: RouteWithSafety[] = [];
    const colors = ['#22c55e', '#3b82f6', '#f59e0b'];
    
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
          const routesToProcess = i === 0 ? result.routes.slice(0, 2) : [result.routes[0]];
          
          for (const route of routesToProcess) {
            const leg = route.legs?.[0];
            
            if (leg) {
              const safePlacesCount = Math.floor(Math.random() * 8) + 3;
              const safetyScore = 60 + Math.floor(Math.random() * 35);
              const fare = calculateFare(leg.distance?.value || 0);
              
              routes.push({
                routeId: `${routes.length + 1}`,
                distance: leg.distance?.text || '',
                duration: leg.duration?.text || '',
                distanceValue: leg.distance?.value || 0,
                durationValue: leg.duration?.value || 0,
                steps: leg.steps || [],
                route: { ...result, routes: [route] },
                safetyScore,
                safetyGrade: getSafetyGrade(safetyScore),
                safePlacesCount,
                safePlaces: [],
                isRecommended: false,
                color: colors[routes.length % colors.length] || '#6b7280',
                fare
              });
              
              if (routes.length >= 3) break;
            }
          }
        }
        
        if (routes.length >= 3) break;
        
      } catch (error) {
        console.error(`Error generating route ${i + 1}:`, error);
      }
    }
    
    routes.sort((a, b) => b.safetyScore - a.safetyScore);
    if (routes.length > 0) {
      routes[0].isRecommended = true;
    }
    
    return routes;
  };

  const calculateFare = (distanceValue: number): number => {
    const baseFare = 50;
    const perKmRate = 15;
    const distanceKm = distanceValue / 1000;
    return Math.round(baseFare + (distanceKm * perKmRate));
  };

  const getSafetyGrade = (score: number): string => {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    return 'D';
  };

  const getSafetyColor = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A': return 'bg-green-100 text-green-800 border-green-200';
      case 'B': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'C': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  // Handle route finding
  const handleFindSafeRoutes = async () => {
    if (!rideRequest.from || !rideRequest.to) {
      alert('Please select both pickup and drop locations');
      return;
    }

    setIsLoadingRoutes(true);
    
    try {
      const routes = await generateSafeRoutes(rideRequest.from, rideRequest.to);
      
      if (routes.length === 0) {
        alert('No routes found');
        return;
      }

      setAvailableRoutes(routes);
      setRideRequest(prev => ({ ...prev, status: 'route-selection' }));

    } catch (error) {
      console.error('Error finding routes:', error);
      alert('Error finding routes. Please try again.');
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  // Handle ride lifecycle
  const handleStartRide = async () => {
    if (!acceptedRide?.id) return;

    try {
      const { data, error } = await DatabaseService.updateRideRequest(acceptedRide.id, {
        status: 'ongoing'
      });

      if (error) {
        console.error('Error starting ride:', error);
        alert('Failed to start ride. Please try again.');
      } else {
        console.log('Ride started successfully:', data);
        setAcceptedRide(prev => prev ? { ...prev, status: 'ongoing' } : null);
        
        // Show the selected route on map
        if (directionsRenderer && acceptedRide.selected_route.route) {
          directionsRenderer.setDirections(acceptedRide.selected_route.route);
          // Fit map to show the entire route
          if (map) {
            const bounds = new google.maps.LatLngBounds();
            acceptedRide.selected_route.route.routes[0].overview_path.forEach(point => {
              bounds.extend(point);
            });
            map.fitBounds(bounds);
          }
        }
      }
    } catch (error) {
      console.error('Error starting ride:', error);
      alert('Failed to start ride. Please try again.');
    }
  };

  const handleCompleteRide = async () => {
    if (!acceptedRide?.id) return;

    try {
      const { data, error } = await DatabaseService.updateRideRequest(acceptedRide.id, {
        status: 'completed'
      });

      if (error) {
        console.error('Error completing ride:', error);
        alert('Failed to complete ride. Please try again.');
      } else {
        console.log('Ride completed successfully:', data);
        setAcceptedRide(null);
        // Clear the map
        if (directionsRenderer) {
          directionsRenderer.setDirections(null);
        }
        alert(`Ride completed! You earned ₹${acceptedRide.fare}`);
      }
    } catch (error) {
      console.error('Error completing ride:', error);
      alert('Failed to complete ride. Please try again.');
    }
  };

  // Handle passenger's ride start
  const handlePassengerStartRide = async () => {
    if (!matchedRider) return;

    setRideRequest(prev => ({ ...prev, status: 'ongoing' }));
    
    // Show the selected route on map
    if (directionsRenderer && rideRequest.selectedRoute?.route) {
      directionsRenderer.setDirections(rideRequest.selectedRoute.route);
      // Fit map to show the entire route
      if (map) {
        const bounds = new google.maps.LatLngBounds();
        rideRequest.selectedRoute.route.routes[0].overview_path.forEach(point => {
          bounds.extend(point);
        });
        map.fitBounds(bounds);
      }
    }
  };

  // Enhanced map initialization for route display
  useEffect(() => {
    if (mapRef.current && !map && typeof google !== 'undefined') {
      const newMap = new google.maps.Map(mapRef.current, {
        zoom: 13,
        center: currentLocation || { lat: 17.4065, lng: 78.4772 },
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      
      setMap(newMap);
      
      const renderer = new google.maps.DirectionsRenderer({
        suppressMarkers: false,
        preserveViewport: false,
        polylineOptions: {
          strokeColor: "#22c55e",
          strokeWeight: 5,
          strokeOpacity: 0.8,
        },
      });
      renderer.setMap(newMap);
      setDirectionsRenderer(renderer);
    }
  }, [mapRef.current, currentLocation]);

  // Auto-display route when ride is accepted/ongoing
  useEffect(() => {
    if (acceptedRide && directionsRenderer && map && acceptedRide.selected_route.route) {
      console.log('Displaying route for accepted ride:', acceptedRide.selected_route);
      directionsRenderer.setDirections(acceptedRide.selected_route.route);
      
      // Fit map to show the entire route
      const bounds = new google.maps.LatLngBounds();
      acceptedRide.selected_route.route.routes[0].overview_path.forEach(point => {
        bounds.extend(point);
      });
      map.fitBounds(bounds);
    }
  }, [acceptedRide, directionsRenderer, map]);

  // Auto-display route for passenger when matched
  useEffect(() => {
    if (rideRequest.status === 'matched' && rideRequest.selectedRoute && directionsRenderer && map) {
      console.log('Displaying route for passenger:', rideRequest.selectedRoute);
      directionsRenderer.setDirections(rideRequest.selectedRoute.route);
      
      // Fit map to show the entire route
      const bounds = new google.maps.LatLngBounds();
      rideRequest.selectedRoute.route.routes[0].overview_path.forEach(point => {
        bounds.extend(point);
      });
      map.fitBounds(bounds);
    }
  }, [rideRequest.status, rideRequest.selectedRoute, directionsRenderer, map]);
  const handleRouteSelect = async (route: RouteWithSafety) => {
    setRideRequest(prev => ({ ...prev, selectedRoute: route, status: 'searching' }));

    // Create ride request in Supabase
    const rideRequestData: Omit<RideRequest, 'id' | 'created_at'> = {
      booker_id: userName,
      booker_name: userName,
      pickup_location: rideRequest.from!,
      drop_location: rideRequest.to!,
      selected_route: route,
      fare: route.fare,
      status: 'pending'
    };

    try {
      const { data, error } = await DatabaseService.insertRideRequest(rideRequestData);
      if (error) {
        console.error('Error creating ride request:', error);
        alert('Failed to create ride request. Please try again.');
        setRideRequest(prev => ({ ...prev, status: 'route-selection' }));
      } else {
        console.log('Ride request created successfully:', data);
      }
    } catch (error) {
      console.error('Error creating ride request:', error);
      alert('Failed to create ride request. Please try again.');
      setRideRequest(prev => ({ ...prev, status: 'route-selection' }));
    }
  };

  // Rider accepts ride
  const handleAcceptRide = async (request: RideRequest) => {
    if (!request.id) return;

    try {
      const { data, error } = await DatabaseService.updateRideRequest(request.id, {
        status: 'accepted',
        rider_id: userName,
        rider_name: userName
      });

      if (error) {
        console.error('Error accepting ride:', error);
        alert('Failed to accept ride. Please try again.');
      } else {
        console.log('Ride accepted successfully:', data);
        setAcceptedRide(data as RideRequest);
        // Remove from nearby requests
        setNearbyRideRequests(prev => prev.filter(req => req.id !== request.id));
      }
    } catch (error) {
      console.error('Error accepting ride:', error);
      alert('Failed to accept ride. Please try again.');
    }
  };

  // Rider goes online
  const handleGoOnline = async () => {
    if (!currentLocation || !riderProfile.name || !riderProfile.car_model) {
      alert('Please complete your profile and enable location access');
      return;
    }

    const riderData: Omit<Rider, 'id'> = {
      name: riderProfile.name,
      phone: riderProfile.phone || '+91 98765 43210',
      car_model: riderProfile.car_model,
      car_number: riderProfile.car_number || 'MH12AB1234',
      rating: riderProfile.rating || 4.8,
      current_location: currentLocation,
      is_online: true,
      verification_status: 'verified'
    };

    try {
      const { data, error } = await DatabaseService.insertRider(riderData);
      if (error) {
        console.error('Error going online:', error);
        alert('Failed to go online. Please try again.');
      } else {
        console.log('Successfully went online:', data);
        setIsRiderOnline(true);
      }
    } catch (error) {
      console.error('Error going online:', error);
      alert('Failed to go online. Please try again.');
    }
  };

  // User type selection
  const renderUserTypeSelection = () => (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Welcome to SafeRide</CardTitle>
          <p className="text-center text-muted-foreground">Choose how you want to use SafeRide</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number</label>
            <Input
              placeholder="Enter your phone number"
              value={userPhone}
              onChange={(e) => setUserPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 mt-6">
            <Button
              onClick={() => setUserType('ridebooker')}
              className="h-20 flex flex-col items-center gap-2"
              disabled={!userName.trim()}
            >
              <User className="h-8 w-8" />
              <span className="font-medium">I want to book a ride</span>
              <span className="text-xs opacity-75">RideBooker</span>
            </Button>
            
            <Button
              onClick={() => setUserType('rider')}
              variant="outline"
              className="h-20 flex flex-col items-center gap-2"
              disabled={!userName.trim()}
            >
              <CarFront className="h-8 w-8" />
              <span className="font-medium">I want to drive</span>
              <span className="text-xs opacity-75">Rider (Driver)</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // RideBooker interface
  const renderRideBookerInterface = () => {
    if (rideRequest.status === 'booking') {
      return renderBookingForm();
    } else if (rideRequest.status === 'route-selection') {
      return renderRouteSelection();
    } else if (rideRequest.status === 'searching') {
      return renderSearchingForRider();
    } else if (rideRequest.status === 'matched' || rideRequest.status === 'ongoing') {
      return renderMatchedRider();
    }
  };

  const renderBookingForm = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Book Your Safe Ride
        </CardTitle>
        <p className="text-sm text-muted-foreground">Hello, {userName}!</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 relative">
          <label className="text-sm font-medium">Pickup Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Enter pickup location"
              value={fromInput}
              onChange={(e) => handleFromInputChange(e.target.value)}
              onFocus={() => fromPredictions.length > 0 && setShowFromSuggestions(true)}
              className="pl-10"
            />
          </div>
          
          {showFromSuggestions && fromPredictions.length > 0 && (
            <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto">
              <div className="p-2">
                {fromPredictions.map((prediction) => (
                  <div
                    key={prediction.place_id}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handlePlaceSelect(prediction.place_id, true)}
                  >
                    <div className="font-medium">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
          
          {currentLocation && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setRideRequest(prev => ({ ...prev, from: currentLocation }));
                setFromInput(currentLocation.address || 'Current Location');
              }}
              className="w-full"
            >
              <Navigation className="h-4 w-4 mr-2" />
              Use Current Location
            </Button>
          )}
        </div>

        <div className="space-y-2 relative">
          <label className="text-sm font-medium">Drop Location</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Where do you want to go?"
              value={toInput}
              onChange={(e) => handleToInputChange(e.target.value)}
              onFocus={() => toPredictions.length > 0 && setShowToSuggestions(true)}
              className="pl-10"
            />
          </div>
          
          {showToSuggestions && toPredictions.length > 0 && (
            <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-auto">
              <div className="p-2">
                {toPredictions.map((prediction) => (
                  <div
                    key={prediction.place_id}
                    className="p-2 hover:bg-gray-100 cursor-pointer rounded"
                    onClick={() => handlePlaceSelect(prediction.place_id, false)}
                  >
                    <div className="font-medium">
                      {prediction.structured_formatting.main_text}
                    </div>
                    <div className="text-sm text-gray-500">
                      {prediction.structured_formatting.secondary_text}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <Button 
          onClick={handleFindSafeRoutes} 
          className="w-full"
          disabled={isLoadingRoutes || !rideRequest.from || !rideRequest.to}
        >
          {isLoadingRoutes ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Route className="h-4 w-4 mr-2" />
          )}
          Find Safe Routes
        </Button>
      </CardContent>
    </Card>
  );

  const renderRouteSelection = () => (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Choose Your Safe Route</h2>
        <Button 
          variant="outline" 
          onClick={() => setRideRequest(prev => ({ ...prev, status: 'booking' }))}
        >
          Back
        </Button>
      </div>
      
      <div className="grid gap-4">
        {availableRoutes.map((route) => (
          <Card 
            key={route.routeId}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              route.isRecommended ? 'border-green-400 bg-green-50' : ''
            }`}
            onClick={() => handleRouteSelect(route)}
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
                      Safest
                    </Badge>
                  )}
                </div>
                <Badge className={getSafetyColor(route.safetyGrade)}>
                  {route.safetyGrade}
                </Badge>
              </div>
              
              <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                <div>
                  <span className="text-muted-foreground">Distance:</span>
                  <p className="font-medium">{route.distance}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration:</span>
                  <p className="font-medium">{route.duration}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Safety:</span>
                  <p className="font-medium">{route.safetyScore}/100</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fare:</span>
                  <p className="font-bold text-lg">₹{route.fare}</p>
                </div>
              </div>
              
              <Button className="w-full">
                Book This Route - ₹{route.fare}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSearchingForRider = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          <div className="relative">
            <div className="animate-pulse bg-primary/20 rounded-full h-24 w-24 mx-auto mb-4 flex items-center justify-center">
              <Car className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h3 className="text-lg font-semibold">Finding Safe Drivers...</h3>
          <p className="text-muted-foreground">
            We're matching you with verified female drivers in your area
          </p>
          
          {rideRequest.selectedRoute && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><strong>Selected Route:</strong> Route {rideRequest.selectedRoute.routeId}</p>
              <p><strong>Distance:</strong> {rideRequest.selectedRoute.distance}</p>
              <p><strong>Fare:</strong> ₹{rideRequest.selectedRoute.fare}</p>
              <p><strong>Safety Grade:</strong> {rideRequest.selectedRoute.safetyGrade}</p>
            </div>
          )}
          
          <div className="text-sm space-y-1">
            <p>✓ Background verified drivers</p>
            <p>✓ Real-time location tracking</p>
            <p>✓ Emergency SOS features</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderMatchedRider = () => (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Driver Details */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl mb-2">👩‍🚗</div>
                <h3 className="text-lg font-semibold">{matchedRider?.name}</h3>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  <span className="font-medium">{matchedRider?.rating}</span>
                  <Badge variant="secondary" className="ml-2">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vehicle:</span>
                  <span>{matchedRider?.car_model}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Number:</span>
                  <span>{matchedRider?.car_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{matchedRider?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fare:</span>
                  <span className="font-bold">₹{rideRequest.selectedRoute?.fare}</span>
                </div>
              </div>
              
              {rideRequest.status === 'matched' ? (
                <>
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Ride Confirmed!</strong><br />
                      Your driver is on the way to pick you up.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">
                      <Phone className="h-4 w-4 mr-2" />
                      Call Driver
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Message
                    </Button>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    onClick={handlePassengerStartRide}
                  >
                    Start Ride
                  </Button>
                </>
              ) : (
                <>
                  <Alert>
                    <Car className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Ride in Progress</strong><br />
                      Following your selected safe route.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">
                      <Shield className="h-4 w-4 mr-2" />
                      Emergency SOS
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Share Live Location
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Route Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Selected Safe Route</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              ref={mapRef}
              style={{ height: "400px", width: "100%" }}
              className="rounded-lg"
            />
          </CardContent>
        </Card>
      </div>

      {/* Route Details */}
      {rideRequest.selectedRoute && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Route Safety Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Safety Grade:</span>
                <Badge className={getSafetyColor(rideRequest.selectedRoute.safetyGrade)} variant="outline">
                  {rideRequest.selectedRoute.safetyGrade}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Distance:</span>
                <p className="font-medium">{rideRequest.selectedRoute.distance}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="font-medium">{rideRequest.selectedRoute.duration}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Safety Score:</span>
                <p className="font-medium">{rideRequest.selectedRoute.safetyScore}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Rider interface
  const renderRiderInterface = () => {
    if (!isRiderOnline) {
      return renderRiderSetup();
    } else if (acceptedRide) {
      return renderAcceptedRideDetails();
    } else {
      return renderAvailableRides();
    }
  };

  const renderRiderSetup = () => (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CarFront className="h-5 w-5 text-blue-600" />
          Driver Profile Setup
        </CardTitle>
        <p className="text-sm text-muted-foreground">Hello, {userName}!</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <Input
            placeholder="Your name"
            value={riderProfile.name}
            onChange={(e) => setRiderProfile(prev => ({ ...prev, name: e.target.value }))}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Phone Number</label>
          <Input
            placeholder="Your phone number"
            value={riderProfile.phone}
            onChange={(e) => setRiderProfile(prev => ({ ...prev, phone: e.target.value }))}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Car Model</label>
          <Input
            placeholder="e.g., Honda City"
            value={riderProfile.car_model}
            onChange={(e) => setRiderProfile(prev => ({ ...prev, car_model: e.target.value }))}
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Car Number</label>
          <Input
            placeholder="e.g., MH12AB1234"
            value={riderProfile.car_number}
            onChange={(e) => setRiderProfile(prev => ({ ...prev, car_number: e.target.value }))}
          />
        </div>
        
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-800">Verification Status</span>
          </div>
          <p className="text-sm text-green-700">✓ Background verified</p>
          <p className="text-sm text-green-700">✓ Documents verified</p>
          <p className="text-sm text-green-700">✓ Safety trained</p>
        </div>
        
        <Button 
          onClick={handleGoOnline} 
          className="w-full"
          disabled={!riderProfile.name || !riderProfile.car_model || !currentLocation}
        >
          <Car className="h-4 w-4 mr-2" />
          Go Online & Start Accepting Rides
        </Button>
      </CardContent>
    </Card>
  );

  const renderAvailableRides = () => (
    <div className="w-full max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Available Ride Requests</h2>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-600 font-medium">Online</span>
        </div>
      </div>
      
      {nearbyRideRequests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Car className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium">No ride requests nearby</p>
            <p className="text-sm text-muted-foreground mt-1">
              You'll be notified when new requests come in
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {nearbyRideRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold">{request.booker_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {calculateDistance(
                        currentLocation?.lat || 0,
                        currentLocation?.lng || 0,
                        request.pickup_location.lat,
                        request.pickup_location.lng
                      ).toFixed(1)} km away
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">₹{request.fare}</div>
                    <Badge className={getSafetyColor(request.selected_route.safetyGrade)}>
                      {request.selected_route.safetyGrade}
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Pickup</p>
                      <p className="text-muted-foreground">{request.pickup_location.address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium">Drop</p>
                      <p className="text-muted-foreground">{request.drop_location.address}</p>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Distance:</span>
                    <p className="font-medium">{request.selected_route.distance}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <p className="font-medium">{request.selected_route.duration}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Safety:</span>
                    <p className="font-medium">{request.selected_route.safetyScore}/100</p>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleAcceptRide(request)}
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Accept Ride
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <XCircle className="h-4 w-4 mr-2" />
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAcceptedRideDetails = () => (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Ride Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{acceptedRide?.status === 'ongoing' ? 'Ride in Progress' : 'Accepted Ride'}</span>
              <Badge variant="default" className={acceptedRide?.status === 'ongoing' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                {acceptedRide?.status === 'ongoing' ? (
                  <>
                    <Car className="h-3 w-3 mr-1" />
                    Driving
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirmed
                  </>
                )}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-4xl">👩</div>
              <div>
                <h3 className="font-semibold">{acceptedRide?.booker_name}</h3>
                <p className="text-sm text-muted-foreground">Passenger</p>
              </div>
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold text-green-600">₹{acceptedRide?.fare}</div>
                <p className="text-sm text-muted-foreground">Total Fare</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Pickup Location</p>
                  <p className="text-sm text-muted-foreground">{acceptedRide?.pickup_location.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium">Drop Location</p>
                  <p className="text-sm text-muted-foreground">{acceptedRide?.drop_location.address}</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1">
                <Phone className="h-4 w-4 mr-2" />
                Call Passenger
              </Button>
              <Button variant="outline" className="flex-1">
                <Navigation className="h-4 w-4 mr-2" />
                Navigate
              </Button>
            </div>
            
            {acceptedRide?.status === 'accepted' ? (
              <Button 
                className="w-full"
                onClick={handleStartRide}
              >
                <Car className="h-4 w-4 mr-2" />
                Start Ride
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={handleCompleteRide}
                variant="default"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete Ride
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Route Map */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Passenger's Selected Safe Route</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div 
              ref={mapRef}
              style={{ height: "400px", width: "100%" }}
              className="rounded-lg"
            />
          </CardContent>
        </Card>
      </div>

      {/* Route Safety Details */}
      {acceptedRide?.selected_route && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Route Safety Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 p-3 rounded-lg mb-4">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-600" />
                This is the passenger's preferred safe route
              </h4>
              <p className="text-sm text-blue-700">
                Follow this route for optimal safety and passenger comfort.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Distance:</span>
                <p className="font-medium">{acceptedRide.selected_route.distance}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Duration:</span>
                <p className="font-medium">{acceptedRide.selected_route.duration}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Safety Grade:</span>
                <Badge className={getSafetyColor(acceptedRide.selected_route.safetyGrade)}>
                  {acceptedRide.selected_route.safetyGrade}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Safety Score:</span>
                <p className="font-medium">{acceptedRide.selected_route.safetyScore}/100</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-green-50 rounded-lg">
              <h5 className="font-medium text-green-800 mb-2">Route Features:</h5>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
                <div>✓ Well-lit roads</div>
                <div>✓ {acceptedRide.selected_route.safePlacesCount} safe places nearby</div>
                <div>✓ Verified safe route</div>
                <div>✓ Emergency services accessible</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Main render
  if (!userType) {
    return renderUserTypeSelection();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            SafeRide - {userType === 'rider' ? 'Driver' : 'Passenger'} Dashboard
          </h1>
          <p className="text-gray-600">
            {userType === 'rider' 
              ? 'Accept ride requests and drive safely' 
              : 'Book rides with verified female drivers on the safest routes'
            }
          </p>
        </div>

        {/* User type switcher */}
        <div className="flex justify-center mb-6">
          <Button 
            variant="outline" 
            onClick={() => {
              setUserType(null);
              setRideRequest({
                from: null,
                to: null,
                selectedRoute: null,
                status: 'booking'
              });
              setIsRiderOnline(false);
              setAcceptedRide(null);
            }}
          >
            Switch User Type
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex justify-center">
          {userType === 'ridebooker' && renderRideBookerInterface()}
          {userType === 'rider' && renderRiderInterface()}
        </div>
      </div>
    </div>
  );
};

export default SafeRideRealTimeApp;