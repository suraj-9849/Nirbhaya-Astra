import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Car, 
  Bike, 
  Truck, 
  Clock, 
  Users, 
  Shield,
  Star
} from 'lucide-react';

interface VehicleType {
  id: string;
  name: string;
  icon: React.ReactNode;
  basefare: number;
  perKmRate: number;
  capacity: string;
  eta: string;
  description: string;
  safetyFeatures: string[];
}

interface VehicleSelectionProps {
  distance: number; // in km
  onVehicleSelect: (vehicle: VehicleType, fare: number) => void;
  selectedVehicle?: string;
}

const VehicleSelection: React.FC<VehicleSelectionProps> = ({ 
  distance, 
  onVehicleSelect, 
  selectedVehicle 
}) => {
  const [selectedId, setSelectedId] = useState<string>(selectedVehicle || '');

  const vehicleTypes: VehicleType[] = [
    {
      id: 'auto',
      name: 'Auto Rickshaw',
      icon: <Truck className="h-8 w-8" />,
      basefare: 40,
      perKmRate: 12,
      capacity: '3 passengers',
      eta: '3-5 mins',
      description: 'Affordable and quick for short distances',
      safetyFeatures: ['GPS tracking', 'Driver verification', 'Emergency button']
    },
    {
      id: 'bike',
      name: 'Motorcycle',
      icon: <Bike className="h-8 w-8" />,
      basefare: 30,
      perKmRate: 8,
      capacity: '1 passenger',
      eta: '2-4 mins',
      description: 'Fastest option for solo travel',
      safetyFeatures: ['Helmet provided', 'GPS tracking', 'Female riders only', 'Live location sharing']
    },
    {
      id: 'car',
      name: 'Car',
      icon: <Car className="h-8 w-8" />,
      basefare: 60,
      perKmRate: 18,
      capacity: '4 passengers',
      eta: '5-8 mins',
      description: 'Comfortable and spacious ride',
      safetyFeatures: ['AC comfort', 'GPS tracking', 'Emergency SOS', 'Female drivers', 'Background verified']
    }
  ];

  const calculateFare = (vehicle: VehicleType): number => {
    return Math.round(vehicle.basefare + (distance * vehicle.perKmRate));
  };

  const handleVehicleSelect = (vehicle: VehicleType) => {
    const fare = calculateFare(vehicle);
    setSelectedId(vehicle.id);
    onVehicleSelect(vehicle, fare);
  };

  const getPopularityBadge = (vehicleId: string) => {
    switch (vehicleId) {
      case 'car':
        return <Badge variant="default" className="bg-green-100 text-green-800">Most Popular</Badge>;
      case 'bike':
        return <Badge variant="secondary">Fastest</Badge>;
      case 'auto':
        return <Badge variant="outline">Budget</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-semibold">Choose Your Safe Ride</h3>
        <p className="text-sm text-muted-foreground">
          Distance: {distance.toFixed(1)} km • All vehicles with female drivers
        </p>
      </div>

      <div className="space-y-3">
        {vehicleTypes.map((vehicle) => {
          const fare = calculateFare(vehicle);
          const isSelected = selectedId === vehicle.id;
          
          return (
            <Card 
              key={vehicle.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-green-500 bg-green-50' : ''
              }`}
              onClick={() => handleVehicleSelect(vehicle)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      <div className={isSelected ? 'text-green-600' : 'text-gray-600'}>
                        {vehicle.icon}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{vehicle.name}</h4>
                        {getPopularityBadge(vehicle.id)}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {vehicle.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {vehicle.capacity}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {vehicle.eta}
                        </div>
                      </div>
                      
                      {/* Safety Features */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {vehicle.safetyFeatures.slice(0, 3).map((feature, index) => (
                          <Badge 
                            key={index} 
                            variant="outline" 
                            className="text-xs px-2 py-0"
                          >
                            <Shield className="h-2 w-2 mr-1" />
                            {feature}
                          </Badge>
                        ))}
                        {vehicle.safetyFeatures.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{vehicle.safetyFeatures.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">₹{fare}</div>
                    <div className="text-xs text-muted-foreground">
                      Base: ₹{vehicle.basefare} + ₹{vehicle.perKmRate}/km
                    </div>
                  </div>
                </div>
                
                {isSelected && (
                  <div className="mt-3 pt-3 border-t bg-green-50 -mx-4 -mb-4 px-4 pb-4 rounded-b-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Selected for safety and comfort
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        <span className="text-sm font-medium">4.8+ rated drivers</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedId && (
        <div className="text-center">
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => {
              const selected = vehicleTypes.find(v => v.id === selectedId);
              if (selected) {
                handleVehicleSelect(selected);
              }
            }}
          >
            Continue with {vehicleTypes.find(v => v.id === selectedId)?.name}
          </Button>
        </div>
      )}

      {/* Safety Assurance */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-blue-800">SafeRide Guarantee</h4>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm text-blue-700">
            <div>✓ Female drivers only</div>
            <div>✓ Background verified</div>
            <div>✓ Live GPS tracking</div>
            <div>✓ Emergency SOS button</div>
            <div>✓ 24/7 support</div>
            <div>✓ Insurance covered</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VehicleSelection;