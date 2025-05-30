"use client"
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import AadhaarValidation from './AadhaarValidation';
import SafeRideCompleteApp from './SafeRideCompleteApp';
import { 
  Shield, 
  CheckCircle, 
  LogOut, 
  User, 
  Calendar,
  MapPin,
  Settings,
  Bell,
  UserCheck,
  Car
} from 'lucide-react';

// Enhanced Authentication service with better data persistence
class AuthService {
  // Check if user is authenticated and validated
  static checkAuthStatus(): { isAuthenticated: boolean, userData: any } {
    try {
      const validation = localStorage.getItem('saferide_validation');
      const authData = localStorage.getItem('saferide_auth');
      
      if (validation && authData) {
        const validationData = JSON.parse(validation);
        const authUserData = JSON.parse(authData);
        
        // Check if validation is still valid (24 hours)
        const expiresAt = new Date(validationData.expires_at);
        if (expiresAt > new Date()) {
          return {
            isAuthenticated: true,
            userData: {
              ...authUserData,
              validation: validationData
            }
          };
        } else {
          // Expired, clear data
          this.clearAuth();
        }
      }
      
      return { isAuthenticated: false, userData: null };
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { isAuthenticated: false, userData: null };
    }
  }

  // Store user authentication data with better structure
  static storeAuthData(userData: any): void {
    const authData = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: userData.name,
      phone: userData.phone || '',
      email: userData.email || '',
      gender: userData.gender,
      verificationMethod: userData.method,
      verificationConfidence: userData.confidence,
      registeredAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      profileComplete: true
    };
    
    localStorage.setItem('saferide_auth', JSON.stringify(authData));
    
    // Also set a session flag
    sessionStorage.setItem('saferide_session_active', 'true');
    
    console.log('Auth data stored successfully:', authData);
  }

  // Update last login
  static updateLastLogin(): void {
    try {
      const authData = localStorage.getItem('saferide_auth');
      if (authData) {
        const userData = JSON.parse(authData);
        userData.lastLogin = new Date().toISOString();
        localStorage.setItem('saferide_auth', JSON.stringify(userData));
      }
    } catch (error) {
      console.error('Error updating last login:', error);
    }
  }

  // Clear all authentication data
  static clearAuth(): void {
    localStorage.removeItem('saferide_auth');
    localStorage.removeItem('saferide_validation');
    sessionStorage.removeItem('saferide_session_active');
    document.cookie = 'saferide_verified=; path=/; max-age=0';
    document.cookie = 'saferide_session=; path=/; max-age=0';
  }

  // Get user profile
  static getUserProfile(): any {
    try {
      const authData = localStorage.getItem('saferide_auth');
      const validationData = localStorage.getItem('saferide_validation');
      
      if (authData && validationData) {
        return {
          ...JSON.parse(authData),
          validation: JSON.parse(validationData)
        };
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    }
  }

  // Check if session is active
  static isSessionActive(): boolean {
    return sessionStorage.getItem('saferide_session_active') === 'true';
  }
}

interface LoginFormData {
  name: string;
  phone: string;
  email: string;
}

const SafeRideAuthSystem: React.FC = () => {
  const [authState, setAuthState] = useState<'checking' | 'login' | 'aadhaar-verification' | 'authenticated'>('checking');
  const [userData, setUserData] = useState<any>(null);
  const [loginForm, setLoginForm] = useState<LoginFormData>({
    name: '',
    phone: '',
    email: ''
  });
  const [showProfile, setShowProfile] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    console.log('Checking authentication status...');
    
    const { isAuthenticated, userData: authUserData } = AuthService.checkAuthStatus();
    
    if (isAuthenticated && AuthService.isSessionActive()) {
      console.log('User is authenticated:', authUserData);
      setUserData(authUserData);
      setAuthState('authenticated');
      AuthService.updateLastLogin();
    } else {
      console.log('User is not authenticated');
      setAuthState('login');
    }
  }, []);

  // Handle login form submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    // Basic validation
    if (!loginForm.name.trim() || !loginForm.phone.trim()) {
      setLoginError('Please fill in all required fields');
      return;
    }

    if (loginForm.phone.length < 10) {
      setLoginError('Please enter a valid phone number');
      return;
    }

    console.log('Login form submitted:', loginForm);

    // Store basic user data temporarily
    setUserData(loginForm);
    setAuthState('aadhaar-verification');
  };

  // Handle Aadhaar validation success
  const handleAadhaarSuccess = (aadhaarData: any) => {
    console.log('Aadhaar validation successful:', aadhaarData);
    
    const completeUserData = {
      ...loginForm,
      ...aadhaarData
    };

    // Store authentication data
    AuthService.storeAuthData(completeUserData);
    setUserData(completeUserData);
    setAuthState('authenticated');
    
    console.log('User authentication completed:', completeUserData);
  };

  // Handle Aadhaar validation failure
  const handleAadhaarFailure = (error: string) => {
    console.error('Aadhaar validation failed:', error);
    // Return to login form
    setAuthState('login');
    setLoginError('Aadhaar verification failed. Please try again.');
  };

  // Handle logout
  const handleLogout = () => {
    console.log('Logging out user...');
    AuthService.clearAuth();
    setUserData(null);
    setAuthState('login');
    setShowProfile(false);
    setLoginForm({ name: '', phone: '', email: '' });
  };

  // Handle back to login from Aadhaar verification
  const handleBackToLogin = () => {
    setAuthState('login');
    setLoginError(null);
  };

  // Render loading state
  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-pulse">
              <Shield className="h-12 w-12 mx-auto mb-4 text-blue-600" />
              <h3 className="text-lg font-semibold">Loading SafeRide...</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Checking authentication status
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render login form
  if (authState === 'login') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Shield className="h-8 w-8 text-green-600" />
                <span className="text-2xl font-bold">SafeRide</span>
              </div>
              <p className="text-lg font-semibold">Welcome Back</p>
            </CardTitle>
            <p className="text-center text-muted-foreground">
              </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              {loginError && (
                <Alert variant="destructive">
                  <AlertDescription>{loginError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name *</label>
                <Input
                  type="text"
                  placeholder="Enter your full name"
                  value={loginForm.name}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Phone Number *</label>
                <Input
                  type="tel"
                  placeholder="Enter your phone number"
                  value={loginForm.phone}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, phone: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email (Optional)</label>
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full">
                Continue to Verification
              </Button>
            </form>

            <div className="mt-6 space-y-3">
              <div className="bg-blue-50 p-3 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Why Aadhaar Verification?</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Ensures SafeRide is women-only</li>
                  <li>• Prevents misuse and enhances safety</li>
                  <li>• Quick one-time verification process</li>
                  <li>• Your data remains private and secure</li>
                </ul>
              </div>

              <div className="bg-green-50 p-3 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">SafeRide Features</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                  <div>✓ Female drivers only</div>
                  <div>✓ Real-time tracking</div>
                  <div>✓ Safe route planning</div>
                  <div>✓ Emergency SOS</div>
                  <div>✓ Background verification</div>
                  <div>✓ 24/7 support</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render Aadhaar verification
  if (authState === 'aadhaar-verification') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          {/* Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Aadhaar Verification</h2>
                  <p className="text-sm text-muted-foreground">
                    Hello {loginForm.name}, please verify your gender to proceed
                  </p>
                </div>
                <Button variant="outline" onClick={handleBackToLogin}>
                  Back to Login
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Aadhaar Validation Component */}
          <AadhaarValidation
            onValidationSuccess={handleAadhaarSuccess}
            onValidationFailure={handleAadhaarFailure}
          />
        </div>
      </div>
    );
  }

  // Render user profile overlay
  const renderUserProfile = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>User Profile</span>
            <Button variant="ghost" size="sm" onClick={() => setShowProfile(false)}>
              ×
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <User className="h-10 w-10 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg">{userData?.name}</h3>
            <Badge variant="default" className="bg-green-100 text-green-800">
              <UserCheck className="h-3 w-3 mr-1" />
              Verified Female User
            </Badge>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone:</span>
              <span>{userData?.phone}</span>
            </div>
            {userData?.email && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{userData?.email}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verification Method:</span>
              <span>{userData?.validation?.method || 'Aadhaar'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence:</span>
              <span>{userData?.validation?.confidence || 95}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member Since:</span>
              <span>{new Date(userData?.registeredAt || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Login:</span>
              <span>{new Date(userData?.lastLogin || Date.now()).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID:</span>
              <span className="font-mono text-xs">{userData?.id?.slice(0, 12)}...</span>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setShowProfile(false)}>
              <Settings className="h-4 w-4 mr-2" />
              Close Profile
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render authenticated app with header
  if (authState === 'authenticated') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-green-600" />
                <h1 className="text-xl font-bold text-gray-900">SafeRide</h1>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <UserCheck className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-sm text-muted-foreground">
                  Welcome, {userData?.name || 'User'}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProfile(true)}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden md:inline">Profile</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden md:inline">Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main App */}
        <SafeRideCompleteApp 
          userProfile={userData}
          onLogout={handleLogout}
        />

        {/* Profile Modal */}
        {showProfile && renderUserProfile()}

        {/* Verification Status Banner */}
        <div className="fixed bottom-4 right-4 z-40">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-800 font-medium">
                  Gender Verified • Safe Ride Active
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default SafeRideAuthSystem;