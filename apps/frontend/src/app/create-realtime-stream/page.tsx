"use client";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Video, MapPin, Shield, Camera, Eye, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Predefined incident cases mapped to severity levels
const INCIDENT_CASES = [
  { label: "Murder / Homicide", severity: 10, color: "bg-red-900 text-red-100", icon: "🔴" },
  { label: "Sexual Assault / Rape", severity: 9, color: "bg-red-800 text-red-100", icon: "🚨" },
  { label: "Kidnapping / Abduction", severity: 9, color: "bg-red-800 text-red-100", icon: "⚠️" },
  { label: "Armed Robbery", severity: 8, color: "bg-red-700 text-red-100", icon: "💰" },
  { label: "Domestic Violence", severity: 7, color: "bg-orange-600 text-orange-100", icon: "🏠" },
  { label: "Assault / Physical Violence", severity: 7, color: "bg-orange-600 text-orange-100", icon: "✊" },
  { label: "Theft / Burglary", severity: 6, color: "bg-orange-500 text-orange-100", icon: "🔓" },
  { label: "Harassment / Stalking", severity: 5, color: "bg-yellow-500 text-yellow-900", icon: "👁️" },
  { label: "Vandalism / Property Damage", severity: 4, color: "bg-yellow-400 text-yellow-900", icon: "🔨" },
  { label: "Public Disturbance", severity: 3, color: "bg-green-500 text-green-100", icon: "📢" }
];

export default function CreateRealtimeStream() {
  const router = useRouter();
  
  // Auth context - simplified like the reference
  const { user } = useAuth();
  
  // State variables
  const [selectedCase, setSelectedCase] = useState(INCIDENT_CASES[0]); // Default to most severe
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [location, setLocation] = useState<string>("");
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [status, setStatus] = useState<string>("");
  const [framesSent, setFramesSent] = useState<number>(0);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string>("");
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [isVideoReadyForCapture, setIsVideoReadyForCapture] = useState<boolean>(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);

  // Get severity from selected case
  const severity = selectedCase.severity;

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to stop all processes and clean up
  const stopAllProcesses = useCallback(() => {
    console.log("Stopping all processes...");
    
    // Clear intervals
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
      console.log("Frame capture interval cleared");
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
      console.log("Recording timer interval cleared");
    }
    
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        console.log("Media recorder stopped");
      } catch (error) {
        console.log("Error stopping media recorder:", error);
      }
    }
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (error) {
          console.log("Error stopping track:", error);
        }
      });
      streamRef.current = null;
      console.log("Video stream stopped");
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      console.log("Video source cleared");
    }
  }, []);

  // Get user's location only after user is available
  useEffect(() => {
    if (!user?.id) return;

    const getLocation = async () => {
      setStatus("🌍 Getting your location...");
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
          });
        });
        
        const { latitude, longitude } = position.coords;
        console.log("Location obtained:", latitude, longitude);
        
        try {
          setStatus("📍 Converting coordinates to address...");
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            {
              headers: {
                'User-Agent': 'Nirbhaya-Astra-App'
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const address = data.display_name || `${latitude}, ${longitude}`;
            setLocation(address);
            setStatus("✅ Location obtained successfully");
          } else {
            throw new Error("Geocoding service unavailable");
          }
        } catch (geocodeError) {
          console.log("Geocoding failed, using coordinates:", geocodeError);
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setStatus("✅ Location obtained (coordinates only)");
        }
        
      } catch (error: any) {
        console.error("Geolocation error:", error);
        
        let errorMessage = "❌ Location access denied. ";
        
        switch (error.code) {
          case 1:
            errorMessage += "Please allow location access and try again.";
            break;
          case 2:
            errorMessage += "Location information is unavailable.";
            break;
          case 3:
            errorMessage += "Location request timed out.";
            break;
          default:
            errorMessage += "Please enter your location manually.";
        }
        
        setStatus(errorMessage);
        setLocation("");
      }
    };
    
    getLocation();
    
    return () => {
      stopAllProcesses();
    };
  }, [user?.id, stopAllProcesses]);

  const sendFrameToServer = useCallback(async (imageData: string): Promise<boolean> => {
    if (!user?.id) {
      console.log("No user ID available for sending frame");
      return false;
    }

    // Prepare the payload once
    const payload = {
      userId: user.id,
      frame: imageData,
      location: location,
      severity: severity,
      timestamp: new Date().toISOString(),
    };

    try {
      // Send immediately without waiting (fire and forget)
      const response = await fetch('/api/video/live-frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("Server response error:", response.status, errorData);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error sending frame to server:", error);
      return false;
    }
  }, [user?.id, location, severity]);

  // Update your captureFrame function with proper video readiness checks and canvas transformation
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isRecording) {
      console.warn("Video or canvas ref not available, or not recording");
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        console.error("Could not get canvas context");
        return;
      }

      // Enhanced video readiness checks
      console.log('📊 Video state check:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        paused: video.paused,
        ended: video.ended,
        currentTime: video.currentTime,
        srcObject: !!video.srcObject
      });

      // Check if video is properly loaded and has valid dimensions
      if (video.readyState < 2) {
        console.warn("⚠️ Video not ready yet, readyState:", video.readyState);
        return;
      }

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.warn("⚠️ Video dimensions not available yet");
        return;
      }

      if (video.paused || video.ended) {
        console.warn("⚠️ Video is paused or ended");
        return;
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      console.log(`📐 Canvas dimensions set to ${canvas.width}x${canvas.height}`);

      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Save the current context state
      context.save();

      // Since your video element has transform: scaleX(-1), we need to flip the canvas content back
      // This ensures the captured frame matches what the user sees
      context.scale(-1, 1);
      context.translate(-canvas.width, 0);

      // Draw the current video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Restore the context to its original state
      context.restore();

      // Convert canvas to base64 data URL
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      
      // Validate the data URL format
      if (!frameDataUrl.startsWith('data:image/')) {
        console.error("❌ Invalid frame format generated:", frameDataUrl.substring(0, 50));
        return;
      }

      // Additional validation - check if the image is not just black/empty
      const testImg = new Image();
      testImg.onload = () => {
        // Create a small test canvas to analyze the image
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 10;
        testCanvas.height = 10;
        const testCtx = testCanvas.getContext('2d');
        
        if (testCtx) {
          testCtx.drawImage(testImg, 0, 0, 10, 10);
          const imageData = testCtx.getImageData(0, 0, 10, 10);
          const pixels = imageData.data;
          
          // Check if image is completely black or too dark
          let totalBrightness = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            totalBrightness += (r + g + b) / 3;
          }
          
          const avgBrightness = totalBrightness / (pixels.length / 4);
          
          if (avgBrightness < 10) {
            console.warn("⚠️ Captured frame appears to be very dark/black. Average brightness:", avgBrightness);
          } else {
            console.log(`✅ Frame captured successfully. Size: ${Math.round(frameDataUrl.length / 1024)}KB, Brightness: ${avgBrightness.toFixed(1)}`);
          }
        }
      };
      testImg.src = frameDataUrl;

      // Prepare frame data
      const frameData = {
        userId: user?.id || 'unknown',
        frame: frameDataUrl,
        location: location,
        severity: severity,
        timestamp: new Date().toISOString()
      };

      // Send to API
      const response = await fetch('/api/video/live-frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(frameData)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ Frame API call failed with status: ${response.status}`);
        console.error('Error response:', errorData);
        throw new Error(`API error: ${errorData}`);
      }

      const result = await response.json();
      console.log('✅ Frame sent successfully:', result);
      
      setFramesSent(prev => prev + 1);

    } catch (error) {
      console.error('💥 Error in frame capture:', error);
    }
  }, [user?.id, location, severity, isRecording]);

  // Simplified initializeCamera - only get the stream
  const initializeCamera = async (): Promise<MediaStream> => {
    setStatus("📷 Requesting camera access...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        },
        audio: true
      });
      streamRef.current = stream;
      setStatus("✅ Camera access granted");
      return stream;
    } catch (error) {
      console.error("Error accessing camera:", error);
      setStatus("❌ Failed to access camera. Please check permissions.");
      throw error;
    }
  };

  // Add useEffect to set stream on video element after it's rendered
  useEffect(() => {
    if (isRecording && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(error => {
        console.error("Error playing video:", error);
        setStatus("❌ Error playing video. Please try again.");
      });
    }
  }, [isRecording]);

  // NEW: Add useEffect to handle frame capture timing
  useEffect(() => {
    if (isRecording && isVideoReadyForCapture && mediaRecorderRef.current?.state === 'recording') {
      console.log("✅ Starting frame capture - video is ready");
      
      // Capture first frame immediately
      captureFrame();
      
      // Set up interval for subsequent frames
      frameIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording' && isRecording) {
          captureFrame();
        } else {
          console.log("🛑 Stopping frame capture - recording not active");
          if (frameIntervalRef.current) {
            clearInterval(frameIntervalRef.current);
            frameIntervalRef.current = null;
          }
        }
      }, 5000);
    } else if (!isRecording || !isVideoReadyForCapture) {
      // Clean up frame capture when recording stops or video isn't ready
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
        console.log("🛑 Frame capture interval cleared");
      }
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isRecording, isVideoReadyForCapture, captureFrame]);

  // Updated startRecording function
  const startRecording = async () => {
    if (!location.trim()) {
      setStatus("⚠️ Please wait for location or enter it manually");
      return;
    }

    try {
      // Step 1: Get webcam stream
      const stream = await initializeCamera();
      streamRef.current = stream;
      
      // Step 2: Set isRecording to true to render video element
      setIsRecording(true);
      setIsVideoReadyForCapture(false); // Reset video ready state

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        });
      } catch (error) {
        console.log("VP9 not supported, trying VP8");
        try {
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8'
          });
        } catch (error) {
          console.log("VP8 not supported, using default");
          mediaRecorder = new MediaRecorder(stream);
        }
      }
      
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        handleStopRecording(chunks);
      };

      setRecordedChunks([]);
      setFramesSent(0);
      setRecordingTime(0);

      // Start the media recorder
      mediaRecorder.start(1000);
      setStatus("🔴 Recording in progress...");
      
      // Start recording timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error starting recording:", error);
      setStatus("❌ Failed to start recording. Please try again.");
      stopAllProcesses();
    }
  };

  // Stop recording function
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setStatus("⚙️ Processing recording...");
      
      // Stop frame capture
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
        console.log("🛑 Frame capture stopped");
      }

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Handle recording completion
  const handleStopRecording = async (chunks: Blob[]) => {
    if (chunks.length === 0) {
      setStatus("❌ No video data captured");
      return;
    }

    try {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setFinalVideoUrl(url);

      await saveFinalVideo(url, blob);
      setStatus("✅ Recording saved successfully");

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsVideoReady(false);

    } catch (error) {
      console.error("Error processing recording:", error);
      setStatus("❌ Error saving video");
    }
  };

  // Save final video - improved error handling and fallbacks
  const saveFinalVideo = async (videoUrl: string, blob: Blob) => {
    try {
      console.log("Preparing to save final video:", {
        userId: user?.id,
        location: location,
        severity: severity,
        size: `${(blob.size / (1024 * 1024)).toFixed(2)} MB`,
        type: blob.type,
        framesSent: framesSent
      });

      // First, check if we have a valid blob
      if (!blob || blob.size === 0) {
        console.error("Error: Video blob is empty or invalid");
        setStatus("❌ Error: Video data is invalid");
        return false;
      }

      // Create form data
      const formData = new FormData();
      
      // Add video blob with filename and explicit MIME type
      formData.append('video', blob, 'incident.webm');
      
      // Add metadata
      formData.append('userId', user?.id || '');
      formData.append('location', location);
      formData.append('severity', severity.toString());
      formData.append('framesSent', framesSent.toString());
      formData.append('videoUrl', videoUrl); // Also send the blob URL for reference
      
      console.log("Sending video to server...");
      
      // Make the API request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch('/api/video/final-videos', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check response
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Server error (${response.status}): ${errorText}`);
          throw new Error(`Server error: ${response.status}`);
        }
        
        // Parse response
        const result = await response.json();
        console.log("Server response:", result);
        
        return true;
      } catch (fetchError: any) {
        console.error("Fetch error:", fetchError.message);
        
        // If the error is a timeout or network error, save locally as fallback
        if (fetchError.name === 'AbortError' || 
            fetchError.message.includes('network') || 
            fetchError.message.includes('fetch')) {
          
          console.log("API call failed, saving video locally as fallback");
          
          // Save blob URL to localStorage as fallback
          try {
            // Create a persistent URL using IndexedDB or localStorage
            const timestamp = new Date().toISOString();
            const key = `video_${user?.id || 'unknown'}_${timestamp}`;
            
            // Store metadata
            const metadata = {
              userId: user?.id,
              location: location,
              severity: severity,
              timestamp: timestamp,
              framesSent: framesSent,
              videoUrl: videoUrl
            };
            
            localStorage.setItem(key, JSON.stringify(metadata));
            console.log("Video metadata saved locally with key:", key);
            
            setStatus("💾 Video saved locally (server unavailable)");
            return true;
          } catch (localError) {
            console.error("Failed to save locally:", localError);
            throw new Error("Failed to save video (both remote and local storage failed)");
          }
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error("Error saving final video:", error);
      setStatus(`❌ Error saving video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle authentication check - after all hooks
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md w-full transform transition-all duration-500 hover:scale-105">
          <div className="mb-4">
            <Shield className="w-16 h-16 text-red-600 mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Nirbhaya Astra</h1>
          <p className="text-gray-600 mb-6">Please sign in to report an incident</p>
          <div className="space-y-3">
            <Button className="w-full bg-red-600 hover:bg-red-700 transition-all duration-300">
              <Link href="/auth/login" className="text-white">
                Sign In
              </Link>
            </Button>
            <p className="text-sm text-gray-500">
              Don't have an account?{" "}
              <Link href="/auth/signup" className="text-red-600 hover:underline font-medium">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 transform transition-all duration-700 opacity-100 translate-y-0">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-gray-800">Record Incident</h1>
          </div>
          <p className="text-gray-600">Securely document and report incidents in real-time</p>
        </div>
        
        {/* Status message */}
        {status && (
          <div className="mb-6 p-4 bg-white border-l-4 border-blue-500 rounded-lg shadow-sm max-w-2xl mx-auto transform transition-all duration-500">
            <div className="text-blue-700 font-medium">{status}</div>
          </div>
        )}
        
        {/* Main Content Container */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls (or full width when not recording) */}
          <div className={`${isRecording ? 'lg:col-span-1' : 'lg:col-span-3 max-w-md mx-auto'} space-y-6 transform transition-all duration-700`}>
            
            {/* Pre-recording setup */}
            {!isRecording && !finalVideoUrl && (
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-6 transform transition-all duration-500 hover:shadow-2xl">
                {/* Incident Type Selector */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Incident Type
                  </label>
                  <div className="relative">
                    <button
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      className={`w-full p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all duration-200 ${selectedCase.color} flex items-center justify-between transform hover:scale-105`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{selectedCase.icon}</span>
                        <span className="font-medium">{selectedCase.label}</span>
                      </div>
                      <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-96 overflow-y-auto animate-in slide-in-from-top-2 duration-300">
                        {INCIDENT_CASES.map((incidentCase, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedCase(incidentCase);
                              setIsDropdownOpen(false);
                            }}
                            className="w-full p-4 text-left hover:bg-gray-50 transition-colors duration-150 first:rounded-t-xl last:rounded-b-xl border-b border-gray-100 last:border-b-0 transform hover:scale-102"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{incidentCase.icon}</span>
                              <div>
                                <div className="font-medium text-gray-800">{incidentCase.label}</div>
                                <div className="text-xs text-gray-500">Severity Level: {incidentCase.severity}/10</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Location
                  </label>
                  <div className="flex gap-3 items-center p-4 border-2 border-gray-200 rounded-xl hover:border-gray-300 transition-colors bg-white focus-within:border-blue-500">
                    <MapPin className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <input 
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Enter location if not detected automatically"
                      className="flex-grow outline-none text-gray-800 placeholder-gray-400 bg-transparent border-none focus:ring-0"
                      style={{ color: '#1f2937' }}
                    />
                  </div>
                </div>
                
                {/* Start recording button */}
                <Button
                  onClick={startRecording}
                  disabled={!location.trim()}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center gap-3">
                    <Video className="w-5 h-5" />
                    <span>Start Recording</span>
                  </div>
                </Button>

                {/* Emergency Notice */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 transition-all duration-300 hover:bg-red-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700">
                      <p className="font-medium mb-1">Emergency Notice</p>
                      <p>If you're in immediate danger, call emergency services first before recording.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recording Controls Panel */}
            {isRecording && (
              <div className="bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-in slide-in-from-left duration-500">
                {/* Recording Status */}
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-600 animate-pulse"></div>
                    <span className="font-semibold text-red-800">RECORDING</span>
                  </div>
                  <div className="text-red-800 font-mono text-lg">
                    {formatTime(recordingTime)}
                  </div>
                </div>

                {/* Incident Info */}
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl ${selectedCase.color} transition-all duration-300`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{selectedCase.icon}</span>
                      <div>
                        <div className="font-semibold">{selectedCase.label}</div>
                        <div className="text-sm opacity-90">Severity: {selectedCase.severity}/10</div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 p-3 rounded-lg text-center border border-blue-200 transition-all duration-300 hover:bg-blue-100">
                      <div className="text-blue-600 font-semibold text-lg">{framesSent}</div>
                      <div className="text-blue-600 text-xs">Frames Sent</div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg text-center border border-green-200 transition-all duration-300 hover:bg-green-100">
                      <div className="text-green-600 font-semibold text-lg">{Math.floor(recordingTime / 60)}m {recordingTime % 60}s</div>
                      <div className="text-green-600 text-xs">Duration</div>
                    </div>
                  </div>
                </div>
                
                {/* Stop Button */}
                <Button
                  onClick={stopRecording}
                  className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-4 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-3 h-3 bg-white rounded-sm"></div>
                    <span>Stop Recording</span>
                  </div>
                </Button>
              </div>
            )}
          </div>
          
          {/* Right Panel - Video Preview (when recording) */}
          {isRecording && (
            <div className="lg:col-span-2 animate-in slide-in-from-right duration-500">
              <div className="bg-white rounded-2xl shadow-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-5 h-5 text-gray-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Live Preview</h3>
                </div>
                
                <div className="relative aspect-video bg-gray-900 rounded-xl overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1] transition-all duration-500"
                    onCanPlay={() => {
                      console.log("📹 Video can play in JSX");
                      setIsVideoReadyForCapture(true);
                    }}
                    onError={(e) => {
                      console.error("📹 Video error in JSX:", e);
                      setIsVideoReadyForCapture(false);
                    }}
                  />
                  
                  {/* Overlay UI */}
                  <div className="absolute inset-0 pointer-events-none transition-all duration-500">
                    {/* Recording indicator */}
                    <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-2">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      REC
                    </div>
                    
                    {/* Timer */}
                    <div className="absolute top-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm font-mono">
                      {formatTime(recordingTime)}
                    </div>
                    
                    {/* Frame counter */}
                    <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                      📸 {framesSent} frames
                    </div>
                    
                    {/* Video quality indicator */}
                    <div className="absolute bottom-4 right-4 bg-black bg-opacity-70 text-white px-3 py-1 rounded-full text-sm">
                      {videoRef.current ? 
                        `${videoRef.current.videoWidth}×${videoRef.current.videoHeight}` : 
                        'Loading...'
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Recording completed */}
        {!isRecording && finalVideoUrl && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 animate-in fade-in duration-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 transform transition-all duration-500 hover:scale-110">
                <Camera className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Recording Complete</h3>
              <p className="text-gray-600">Your incident has been recorded and saved securely</p>
            </div>
            
            <div className="aspect-video mb-6 rounded-xl overflow-hidden bg-gray-100">
              <video 
                src={finalVideoUrl} 
                controls 
                className="w-full h-full object-cover transition-all duration-500 hover:scale-105"
              />
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 transition-all duration-300 hover:bg-green-100">
              <div className="flex items-center gap-3 text-green-700 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-semibold">Video saved successfully</span>
              </div>
              <div className="text-sm text-green-600 space-y-1">
                <p>• {framesSent} frames were captured during recording</p>
                <p>• Incident type: {selectedCase.label}</p>
                <p>• Location: {location}</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
              >
                Record Another Incident
              </Button>
              
              
            </div>
          </div>
        )}
        
        {/* Hidden canvas element for frame capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}