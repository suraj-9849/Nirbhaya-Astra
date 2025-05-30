import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Wallet, 
  CheckCircle, 
  XCircle, 
  Loader2,
  Shield,
  DollarSign
} from 'lucide-react';

interface PaymentProps {
  amount: number;
  onPaymentSuccess: (paymentData: any) => void;
  onPaymentFailure: (error: string) => void;
  rideDetails: {
    from: string;
    to: string;
    distance: string;
    vehicleType: string;
  };
}

// Razorpay Integration Component
const PaymentGateway: React.FC<PaymentProps> = ({ 
  amount, 
  onPaymentSuccess, 
  onPaymentFailure, 
  rideDetails 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'upi' | 'wallet'>('card');

  // Initialize Razorpay payment
  const initiatePayment = () => {
    setIsProcessing(true);

    // Razorpay configuration with updated test key
    const options = {
      key: 'rzp_test_FPJ7nRa2ReTOWp', // Updated test key
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      name: 'SafeRide',
      description: `Safe ride from ${rideDetails.from.substring(0, 20)}... to ${rideDetails.to.substring(0, 20)}...`,
      image: '/saferide-logo.png', // Add your logo
      order_id: '', // Generate from backend in production
      handler: function (response: any) {
        setIsProcessing(false);
        console.log('Payment successful:', response);
        onPaymentSuccess({
          payment_id: response.razorpay_payment_id,
          order_id: response.razorpay_order_id,
          signature: response.razorpay_signature,
          amount: amount,
          method: paymentMethod
        });
      },
      prefill: {
        name: 'SafeRide User',
        email: 'user@saferide.com',
        contact: '+91 9999999999'
      },
      notes: {
        ride_type: rideDetails.vehicleType,
        distance: rideDetails.distance,
        safety_ride: 'true'
      },
      theme: {
        color: '#22c55e'
      },
      method: {
        netbanking: true,
        card: true,
        upi: true,
        wallet: true,
        emi: false,
        paylater: false
      },
      modal: {
        ondismiss: function() {
          setIsProcessing(false);
          onPaymentFailure('Payment cancelled by user');
        }
      }
    };

    // Check if Razorpay is loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        setIsProcessing(false);
        console.error('Payment failed:', response.error);
        onPaymentFailure(response.error.description || 'Payment failed');
      });

      rzp.open();
    } else {
      setIsProcessing(false);
      onPaymentFailure('Payment gateway not available. Please try again.');
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-green-600" />
          Complete Payment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ride Summary */}
        <div className="bg-gray-50 p-3 rounded-lg space-y-2">
          <h4 className="font-medium">Ride Summary</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Vehicle:</span>
              <span className="font-medium">{rideDetails.vehicleType}</span>
            </div>
            <div className="flex justify-between">
              <span>Distance:</span>
              <span className="font-medium">{rideDetails.distance}</span>
            </div>
            <div className="flex justify-between">
              <span>From:</span>
              <span className="font-medium text-right">{rideDetails.from.substring(0, 25)}...</span>
            </div>
            <div className="flex justify-between">
              <span>To:</span>
              <span className="font-medium text-right">{rideDetails.to.substring(0, 25)}...</span>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="text-center py-4 border rounded-lg">
          <div className="text-3xl font-bold text-green-600">₹{amount}</div>
          <p className="text-sm text-muted-foreground">Total Amount</p>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant={paymentMethod === 'card' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPaymentMethod('card')}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Card
            </Button>
            <Button 
              variant={paymentMethod === 'upi' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPaymentMethod('upi')}
            >
              <DollarSign className="h-4 w-4 mr-1" />
              UPI
            </Button>
            <Button 
              variant={paymentMethod === 'wallet' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setPaymentMethod('wallet')}
            >
              <Wallet className="h-4 w-4 mr-1" />
              Wallet
            </Button>
          </div>
        </div>

        {/* Security Badge */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Secure Payment</strong><br />
            Your payment is protected by 256-bit SSL encryption powered by Razorpay
          </AlertDescription>
        </Alert>

        {/* Pay Button */}
        <Button 
          onClick={initiatePayment}
          disabled={isProcessing}
          className="w-full h-12"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Processing Payment...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay ₹{amount} Securely
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By proceeding, you agree to SafeRide's terms and conditions
        </p>

        {/* Test Mode Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-sm text-yellow-800">
            <strong>Test Mode:</strong> This is a test payment. Use test card details:
            <br />
            <span className="font-mono">4111 1111 1111 1111</span> (Visa)
            <br />
            CVV: Any 3 digits | Expiry: Any future date
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentGateway;