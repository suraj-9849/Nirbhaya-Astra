"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnalyzeTab } from "./va-components/AnalyzeTab";
import { WatchTab } from "./va-components/WatchTab";
import { IPCamera } from "./va-components/IPCamera";
import { ShieldCheck, Video, Wifi } from "lucide-react";

const Page = () => {
  const [activeTab, setActiveTab] = useState<"analyze" | "watch" | "ipcamera">(
    "analyze",
  );
  const [watchUrl, setWatchUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleError = (errorMessage: string | null) => {
    setError(errorMessage);
  };

  const handleWatchUrlChange = (url: string) => {
    setWatchUrl(url);
  };

  return (
    <div className="flex h-screen flex-col bg-black">
      <div className="flex items-center justify-between bg-black px-6 py-3 shadow-md">
        <div className="flex items-center">
          <ShieldCheck className="mr-3 h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Nirbhaya-Astra Bot
          </h1>
        </div>

        <div className="flex justify-center space-x-2">
          <Button
            variant={activeTab === "analyze" ? "default" : "outline"}
            onClick={() => setActiveTab("analyze")}
            className={`transition-all duration-300 ${
              activeTab === "analyze"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-blue-300 text-blue-600 hover:border-blue-400"
            }`}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            AI Analysis
          </Button>
          <Button
            variant={activeTab === "watch" ? "default" : "outline"}
            onClick={() => setActiveTab("watch")}
            className={`transition-all duration-300 ${
              activeTab === "watch"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-blue-300 text-blue-600 hover:border-blue-400"
            }`}
          >
            <Video className="mr-2 h-4 w-4" />
            Monitor
          </Button>
          <Button
            variant={activeTab === "ipcamera" ? "default" : "outline"}
            onClick={() => setActiveTab("ipcamera")}
            className={`transition-all duration-300 ${
              activeTab === "ipcamera"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "border-blue-300 text-blue-600 hover:border-blue-400"
            }`}
          >
            <Wifi className="mr-2 h-4 w-4" />
            IP Camera
          </Button>
        </div>

        <div className="flex items-center">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="ml-2 text-xs font-medium text-white">
            System Active
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-6">
        {activeTab === "analyze" && (
          <AnalyzeTab
            onError={handleError}
            onWatchUrlChange={handleWatchUrlChange}
          />
        )}

        {activeTab === "watch" && <WatchTab watchUrl={watchUrl} />}

        {activeTab === "ipcamera" && <IPCamera />}
      </div>
    </div>
  );
};

export default Page;
