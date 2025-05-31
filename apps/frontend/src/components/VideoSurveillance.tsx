"use client";
import React, { useEffect, useState } from "react";
import { Video, Eye, AlertTriangle, Clock, MapPin, ChevronLeft, User, ArrowLeft, ArrowRight, CheckCircle, XCircle, Shield } from "lucide-react";

interface LiveFrame {
  id: string;
  frame: string;
  location: string;
  severity: number;
  timestamp: string;
  userId: string;
}

interface FinalVideo {
  id: string;
  videoUrl: string;
  location: string;
  severity: number;
  createdAt: string;
  userId: string;
  isVerified?: boolean;
  verifiedAt?: string;
}

interface VideoSurveillanceProps {
  onBack: () => void;
  isAuthority?: boolean; // Add this prop to identify authority users
}

function VideoSurveillance({ onBack, isAuthority = true }: VideoSurveillanceProps) {
  const [liveFrames, setLiveFrames] = useState<LiveFrame[]>([]);
  const [finalVideos, setFinalVideos] = useState<FinalVideo[]>([]);
  const [selectedFrame, setSelectedFrame] = useState<LiveFrame | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<FinalVideo | null>(null);
  const [userFrames, setUserFrames] = useState<LiveFrame[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);

  // Fetch data every 5 seconds
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [framesRes, videosRes] = await Promise.all([
          fetch("/api/video/live-frames"),
          fetch("/api/video/final-videos"),
        ]);
        
        if (!framesRes.ok) throw new Error(`Failed to fetch frames: ${framesRes.status}`);
        if (!videosRes.ok) throw new Error(`Failed to fetch videos: ${videosRes.status}`);
        
        const framesData = await framesRes.json();
        const videosData = await videosRes.json();
        
        const frames = Array.isArray(framesData) ? framesData : (framesData.data || []);
        const videos = Array.isArray(videosData) ? videosData : (videosData.data || []);
        
        const latestFramesByUser = getMostRecentFramesByUser(frames);
        const sortedFrames = latestFramesByUser.sort((a, b) => b.severity - a.severity);
        const uniqueVideos = removeDuplicates(videos, 'id') as FinalVideo[];
        
        setLiveFrames(sortedFrames);
        setFinalVideos(uniqueVideos);
        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    function removeDuplicates<T>(array: T[], key: keyof T): T[] {
      const seen = new Set();
      return array.filter(item => {
        const itemKey = item[key];
        if (itemKey && !seen.has(itemKey)) {
          seen.add(itemKey);
          return true;
        }
        return false;
      });
    }
    
    function getMostRecentFramesByUser(frames: LiveFrame[]): LiveFrame[] {
      const userFramesMap = new Map<string, LiveFrame[]>();
      
      frames.forEach(frame => {
        if (!frame.userId) return;
        if (!userFramesMap.has(frame.userId)) {
          userFramesMap.set(frame.userId, []);
        }
        userFramesMap.get(frame.userId)!.push(frame);
      });
      
      const latestFrames: LiveFrame[] = [];
      userFramesMap.forEach(userFrames => {
        const sortedUserFrames = userFrames.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });
        
        if (sortedUserFrames.length > 0) {
          latestFrames.push(sortedUserFrames[0]);
        }
      });
      
      return latestFrames;
    }
    
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Authority verification function
  const verifyVideo = async (video: FinalVideo, isValidCase: boolean) => {
    setVerifying(video.id);
    setError(null);
    
    try {
      const response = await fetch('/api/creditupdate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId: video.id,
          userId: video.userId,
          action: isValidCase ? 'valid' : 'false',
          severity: video.severity
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Verification failed: ${errorData}`);
      }

      const result = await response.json();
      
      if (result.success) {
        if (result.action === 'deleted') {
          // Remove video from local state
          setFinalVideos(prev => prev.filter(v => v.id !== video.id));
          // Remove related frames from same user
          setLiveFrames(prev => prev.filter(f => f.userId !== video.userId));
          // Close modal if this video was selected
          if (selectedVideo?.id === video.id) {
            setSelectedVideo(null);
          }
          alert(`False case removed successfully. Deleted ${result.itemsRemoved?.video || 1} video(s) and ${result.itemsRemoved?.frames || 0} frame(s).`);
        } else if (result.action === 'credited') {
          // Update video status in local state
          setFinalVideos(prev => 
            prev.map(v => 
              v.id === video.id 
                ? { ...v, isVerified: true, verifiedAt: new Date().toISOString() }
                : v
            )
          );
          alert(`Valid case verified! User credited with ${result.creditsAwarded} points. Total credits: ${result.newCreditTotal}`);
        }
      } else {
        throw new Error(result.message || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError(`Failed to verify video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setVerifying(null);
    }
  };

  // Fetch all frames for a specific user
  const fetchUserFrames = async (userId: string) => {
    try {
      const response = await fetch(`/api/video/live-frames?userId=${userId}`);
      if (!response.ok) throw new Error(`Failed to fetch user frames: ${response.status}`);
      
      const framesData = await response.json();
      const frames = Array.isArray(framesData) ? framesData : (framesData.data || []);
      
      // Sort frames by timestamp (newest first)
      const sortedFrames = frames
        .filter((frame: LiveFrame) => frame.userId === userId)
        .sort((a: LiveFrame, b: LiveFrame) => {
          const timeA = new Date(a.timestamp).getTime();
          const timeB = new Date(b.timestamp).getTime();
          return timeB - timeA;
        });
      
      setUserFrames(sortedFrames);
      setCurrentFrameIndex(0);
    } catch (error) {
      console.error('Error fetching user frames:', error);
      setUserFrames([]);
    }
  };

  // Handle frame click
  const handleFrameClick = async (frame: LiveFrame) => {
    setSelectedFrame(frame);
    await fetchUserFrames(frame.userId);
  };

  // Navigate between user frames
  const navigateFrame = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    } else if (direction === 'next' && currentFrameIndex < userFrames.length - 1) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return "bg-red-500";
    if (severity >= 6) return "bg-orange-500";
    if (severity >= 4) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getSeverityBadge = (severity: number) => {
    if (severity >= 8) return "High Risk";
    if (severity >= 6) return "Medium Risk";
    if (severity >= 4) return "Low Risk";
    return "Normal";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <button 
              onClick={onBack}
              className="group flex items-center gap-3 px-6 py-3 bg-white/80 backdrop-blur-sm hover:bg-white rounded-xl transition-all duration-200 text-slate-700 hover:text-slate-900 shadow-sm hover:shadow-md border border-white/20"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
              <span className="font-medium">Back to Dashboard</span>
            </button>
            
            {/* Always show authority badge now */}
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-xl border border-blue-200">
              <Shield className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">Authority Access</span>
            </div>
          </div>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-xl mb-8 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-8 py-12 text-white">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl mb-6">
                <Eye className="w-10 h-10 text-blue-400" />
              </div>
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Video Surveillance Center
              </h1>
              <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                Real-time monitoring and incident detection system
              </p>
              
              {/* Live Status */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 font-medium">System Active</span>
              </div>
            </div>
          </div>
          
          <div className="p-8">
            {/* Live Frames Section */}
            <div className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
                  Live Detection Feed
                </h2>
                {loading && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin"></div>
                    <span className="text-sm">Updating...</span>
                  </div>
                )}
              </div>
              
              {liveFrames.length === 0 && !loading ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Eye className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg font-medium">No live frames detected</p>
                  <p className="text-slate-400 text-sm mt-2">Waiting for surveillance data...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {liveFrames.map((frame) => (
                    <div
                      key={frame.id}
                      className="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-200 hover:border-blue-300 transform hover:-translate-y-1"
                      onClick={() => handleFrameClick(frame)}
                    >
                      <div className="relative aspect-video bg-slate-900">
                        {frame.frame ? (
                          <img 
                            src={fixImageUrl(frame.frame)}
                            alt={`Detection ${frame.id}`} 
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/1e293b/64748b?text=Image+Error';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Video className="w-12 h-12 text-slate-500" />
                          </div>
                        )}
                        
                        {/* Severity Badge */}
                        <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-bold ${getSeverityColor(frame.severity)}`}>
                          {getSeverityBadge(frame.severity)}
                        </div>
                        
                        {/* Timestamp */}
                        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs font-medium">
                          {new Date(frame.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      
                      {/* Card Footer */}
                      <div className="p-4 bg-white">
                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate font-medium">{frame.location}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Severity Level</span>
                          <span className="text-lg font-bold text-slate-800">{frame.severity}/10</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Enhanced Final Videos Section with Authority Controls */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <div className="w-2 h-8 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
                  Recorded Incidents
                  <span className="text-sm text-slate-500 font-normal">(Authority Review)</span>
                </h2>
              </div>
              
              {finalVideos.length === 0 && !loading ? (
                <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <Video className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg font-medium">No recorded videos</p>
                  <p className="text-slate-400 text-sm mt-2">Incident recordings will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {finalVideos.map((video) => (
                    <div
                      key={video.id}
                      className="group bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-200 hover:border-purple-300"
                    >
                      <div 
                        className="cursor-pointer transform hover:-translate-y-1 transition-transform duration-300"
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div className="relative aspect-video bg-slate-900">
                          {video.videoUrl ? (
                            <>
                              <img
                                src={`${video.videoUrl.replace(/\.[^/.]+$/, "")}.jpg`}
                                alt={`Video ${video.id} thumbnail`}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const container = (e.target as HTMLImageElement).parentElement;
                                  if (container) {
                                    container.querySelector('.fallback-icon')!.classList.remove('hidden');
                                  }
                                }}
                              />
                              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
                              <Video className="w-12 h-12 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 fallback-icon hidden opacity-60" />
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Video className="w-12 h-12 text-slate-500" />
                            </div>
                          )}
                          
                          {/* Verification Status Badge */}
                          {video.isVerified && (
                            <div className="absolute top-3 left-3 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </div>
                          )}
                          
                          {/* Severity Badge */}
                          <div className={`absolute top-3 ${video.isVerified ? 'right-3' : 'left-3'} px-3 py-1 rounded-full text-white text-xs font-bold ${getSeverityColor(video.severity)}`}>
                            {getSeverityBadge(video.severity)}
                          </div>
                        </div>
                        
                        {/* Card Footer */}
                        <div className="p-4 bg-white">
                          <div className="flex items-center gap-2 text-slate-600 text-sm mb-2">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate font-medium">{video.location}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-500 text-xs">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(video.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Authority Action Buttons - Remove authority check */}
                      {!video.isVerified && (
                        <div className="border-t border-slate-200 p-3 bg-slate-50">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                verifyVideo(video, true);
                              }}
                              disabled={verifying === video.id}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {verifying === video.id ? 'Processing...' : 'Valid Case'}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                verifyVideo(video, false);
                              }}
                              disabled={verifying === video.id}
                              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle className="w-4 h-4" />
                              {verifying === video.id ? 'Processing...' : 'False Case'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Live Frame Modal with User Frame Navigation */}
        {selectedFrame && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <User className="w-6 h-6 text-blue-500" />
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">User Detection History</h3>
                    <p className="text-sm text-slate-500">
                      {userFrames.length} frames detected • User: {selectedFrame.userId}
                    </p>
                  </div>
                </div>
                <button
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors duration-200"
                  onClick={() => {
                    setSelectedFrame(null);
                    setUserFrames([]);
                    setCurrentFrameIndex(0);
                  }}
                >
                  <span className="text-slate-600 text-xl">×</span>
                </button>
              </div>
              
              <div className="p-6">
                {userFrames.length > 0 && (
                  <>
                    {/* Current Frame Display */}
                    <div className="mb-6">
                      <div className="relative">
                        <img 
                          src={fixImageUrl(userFrames[currentFrameIndex].frame)}
                          alt="Detection frame" 
                          className="rounded-xl w-full shadow-lg max-h-96 object-contain bg-slate-900"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x400/1e293b/64748b?text=Image+Error';
                          }}
                        />
                        
                        {/* Navigation Arrows */}
                        {userFrames.length > 1 && (
                          <>
                            <button
                              onClick={() => navigateFrame('prev')}
                              disabled={currentFrameIndex === 0}
                              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                              <ArrowLeft className="w-6 h-6" />
                            </button>
                            <button
                              onClick={() => navigateFrame('next')}
                              disabled={currentFrameIndex === userFrames.length - 1}
                              className="absolute right-4 top-1/2 transform -translate-y-1/2 w-12 h-12 bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            >
                              <ArrowRight className="w-6 h-6" />
                            </button>
                          </>
                        )}
                        
                        {/* Frame Counter */}
                        <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg text-white text-sm font-medium">
                          {currentFrameIndex + 1} / {userFrames.length}
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Frame Details */}
                    <div className="grid md:grid-cols-3 gap-6 mb-6">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-500">Location</p>
                          <p className="font-medium text-slate-800">{userFrames[currentFrameIndex].location}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-500">Risk Level</p>
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getSeverityColor(userFrames[currentFrameIndex].severity)}`}>
                              {getSeverityBadge(userFrames[currentFrameIndex].severity)}
                            </span>
                            <span className="text-slate-600">({userFrames[currentFrameIndex].severity}/10)</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-500" />
                        <div>
                          <p className="text-sm text-slate-500">Detected At</p>
                          <p className="font-medium text-slate-800">{new Date(userFrames[currentFrameIndex].timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Frame Timeline */}
                    <div className="border-t border-slate-200 pt-6">
                      <h4 className="text-lg font-semibold text-slate-800 mb-4">Detection Timeline</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 max-h-64 overflow-y-auto">
                        {userFrames.map((frame, index) => (
                          <div
                            key={frame.id}
                            className={`cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                              index === currentFrameIndex 
                                ? 'border-blue-500 shadow-lg' 
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                            onClick={() => setCurrentFrameIndex(index)}
                          >
                            <div className="aspect-video relative">
                              <img
                                src={fixImageUrl(frame.frame)}
                                alt={`Frame ${index + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x100/1e293b/64748b?text=Error';
                                }}
                              />
                              <div className={`absolute top-1 right-1 px-2 py-1 rounded text-xs font-bold text-white ${getSeverityColor(frame.severity)}`}>
                                {frame.severity}
                              </div>
                            </div>
                            <div className="p-2 bg-white">
                              <p className="text-xs text-slate-500 truncate">
                                {new Date(frame.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Final Video Modal with Authority Actions */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-slate-800">Incident Recording</h3>
                  {selectedVideo.isVerified && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <span className="text-green-800 text-sm font-medium">Verified</span>
                    </div>
                  )}
                </div>
                <button
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors duration-200"
                  onClick={() => setSelectedVideo(null)}
                >
                  <span className="text-slate-600 text-xl">×</span>
                </button>
              </div>
              
              <div className="p-6">
                <div className="mb-6">
                  {selectedVideo.videoUrl ? (
                    <video 
                      controls 
                      className="rounded-xl w-full shadow-lg"
                      poster={`${selectedVideo.videoUrl.replace(/\.[^/.]+$/, "")}.jpg`}
                      onError={(e) => {
                        console.error('Video load error:', e);
                        const videoEl = e.target as HTMLVideoElement;
                        videoEl.poster = 'https://via.placeholder.com/800x450/1e293b/64748b?text=Video+Error';
                        videoEl.style.backgroundColor = '#1e293b';
                      }}
                    >
                      <source src={selectedVideo.videoUrl} type="video/mp4" />
                      <source src={selectedVideo.videoUrl} type="video/webm" />
                      Your browser does not support the video tag.
                    </video>
                  ) : (
                    <div className="bg-slate-100 rounded-xl flex items-center justify-center h-64">
                      <span className="text-slate-500 font-medium">Video not available</span>
                    </div>
                  )}
                </div>
                
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Location</p>
                      <p className="font-medium text-slate-800">{selectedVideo.location}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Risk Level</p>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-white text-sm font-bold ${getSeverityColor(selectedVideo.severity)}`}>
                          {getSeverityBadge(selectedVideo.severity)}
                        </span>
                        <span className="text-slate-600">({selectedVideo.severity}/10)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-500" />
                    <div>
                      <p className="text-sm text-slate-500">Recorded</p>
                      <p className="font-medium text-slate-800">{new Date(selectedVideo.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Authority Action Panel in Modal - Remove authority check */}
                {!selectedVideo.isVerified && (
                  <div className="border-t border-slate-200 pt-6">
                    <h4 className="text-lg font-semibold text-slate-800 mb-4">Authority Verification</h4>
                    <div className="flex gap-4">
                      <button
                        onClick={() => verifyVideo(selectedVideo, true)}
                        disabled={verifying === selectedVideo.id}
                        className="flex items-center justify-center gap-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-medium rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle className="w-5 h-5" />
                        {verifying === selectedVideo.id ? 'Processing...' : `Valid Case (+${selectedVideo.severity} Credits)`}
                      </button>
                      <button
                        onClick={() => verifyVideo(selectedVideo, false)}
                        disabled={verifying === selectedVideo.id}
                        className="flex items-center justify-center gap-3 px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle className="w-5 h-5" />
                        {verifying === selectedVideo.id ? 'Processing...' : 'False Case (Delete)'}
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      Valid cases will credit the user with points equal to the severity level. False cases will be permanently deleted.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function fixVideoUrl(url: string): string {
  if (!url) return '';
  
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  
  if (url.includes('cloudinary.com')) {
    return url;
  }
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  if (!url.startsWith('/') && !url.startsWith('./')) {
    return '/' + url;
  }
  
  if (url.startsWith('./')) {
    return url.substring(2);
  }
  
  return url;
}

function fixImageUrl(url: string): string {
  if (!url) return 'https://via.placeholder.com/400x300/1e293b/64748b?text=No+Image';
  
  if (url.startsWith('data:image')) {
    return url;
  }
  
  if (url.includes('cloudinary.com')) {
    return url.replace('http://', 'https://');
  }
  
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  if (url.startsWith('/')) {
    return window.location.origin + url;
  }
  
  return window.location.origin + '/' + url;
}

export default VideoSurveillance;