"use client";
import LiveTitle from "@/components/LiveTitle";
import RealtimeList from "@/components/RealtimeList";
import VideoSurveillance from "@/components/VideoSurveillance";
import { useAuth } from "../../../contexts/AuthContext";
import React, { useState } from "react";
import { Shield, Video, Activity } from "lucide-react";

function Page() {
  const [selectedDashboard, setSelectedDashboard] = useState<'selection' | 'monitoring' | 'video'>('selection');

  const handleDashboardSelect = (type: 'monitoring' | 'video') => {
    setSelectedDashboard(type);
  };

  const goBack = () => {
    setSelectedDashboard('selection');
  };

  if (selectedDashboard === 'monitoring') {
    return (
      <div className="flex flex-col justify-center mx-auto max-w-5xl w-full p-4">
        <div className="mb-6">
          <button 
            onClick={goBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 text-gray-700"
          >
            ← Back to Dashboard Selection
          </button>
        </div>
        <LiveTitle />
        <RealtimeList />
      </div>
    );
  }

  if (selectedDashboard === 'video') {
    return <VideoSurveillance onBack={goBack} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Shield className="w-12 h-12 text-red-500" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-purple-600 bg-clip-text text-transparent">
              Nirbhaya Astra
            </h1>
          </div>
          <p className="text-xl text-gray-600 font-medium">Authorities Command Center</p>
          <p className="text-gray-500 mt-2">Choose your monitoring dashboard</p>
        </div>

        {/* Dashboard Options */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Safety Monitoring Dashboard */}
          <div 
            onClick={() => handleDashboardSelect('monitoring')}
            className="group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
                <div className="relative z-10">
                  <Activity className="w-12 h-12 mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <h2 className="text-2xl font-bold mb-2">Safety Monitoring</h2>
                  <p className="text-blue-100">Real-time alerts & incident tracking</p>
                </div>
              </div>
              
              <div className="p-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Live emergency alerts</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Incident investigation</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Route monitoring</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>Safety analytics</span>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-green-600">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Video Surveillance Dashboard */}
          <div 
            onClick={() => handleDashboardSelect('video')}
            className="group cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl"
          >
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-10 rounded-full -ml-12 -mb-12"></div>
                <div className="relative z-10">
                  <Video className="w-12 h-12 mb-4 group-hover:scale-110 transition-transform duration-300" />
                  <h2 className="text-2xl font-bold mb-2">Video Surveillance</h2>
                  <p className="text-red-100">Live feeds & AI detection</p>
                </div>
              </div>
              
              <div className="p-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Live camera feeds</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>AI threat detection</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Motion analysis</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-700">
                    <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    <span>Recording system</span>
                  </div>
                </div>
                
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Cameras</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-600">Online</span>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
          <div className="text-center p-4 bg-white rounded-lg shadow-md">
            <div className="text-2xl font-bold text-green-600">System</div>
            <div className="text-sm text-gray-600">Uptime</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-md">
            <div className="text-2xl font-bold text-blue-600">Active</div>
            <div className="text-sm text-gray-600">Users</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-md">
            <div className="text-2xl font-bold text-purple-600">Monitor</div>
            <div className="text-sm text-gray-600">Points</div>
          </div>
          <div className="text-center p-4 bg-white rounded-lg shadow-md">
            <div className="text-2xl font-bold text-red-600">Active</div>
            <div className="text-sm text-gray-600">Alerts</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Page;