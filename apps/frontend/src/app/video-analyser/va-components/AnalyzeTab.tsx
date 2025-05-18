"use client";

import React, { useRef, useCallback, useState, useEffect } from "react";
import {
  PlayIcon,
  Square as StopIcon,
  CameraIcon,
  RefreshCwIcon,
  ShieldCheck,
  AlertCircle,
  Settings2,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import { NotificationPanel } from "./NotificationPanel";
import { detectEvents, type VideoEvent } from "../actions";
import { useDangerSound } from "./useDangerSound";

interface AnalyzeTabProps {
  onError: (error: string | null) => void;
  onWatchUrlChange: (url: string) => void;
}

export const AnalyzeTab: React.FC<AnalyzeTabProps> = ({
  onError,
  onWatchUrlChange,
}) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [ipAddress, setIpAddress] = useState<string>("");
  const [streamUrl, setStreamUrl] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [events, setEvents] = useState<VideoEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [streamKey, setStreamKey] = useState(0);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [analysisCount, setAnalysisCount] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [analysisInterval, setAnalysisInterval] = useState<number>(2000);

  const { playSound, stopSound } = useDangerSound("/danger_alert.mp3");

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (!imgRef.current || !canvasRef.current || !isAnalyzing) return;

    const img = imgRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setError("Failed to get canvas context.");
      return;
    }

    try {
      const MAX_DIM = 480;
      const aspectRatio = img.width / img.height;
      let newWidth, newHeight;
      if (aspectRatio > 1) {
        newWidth = MAX_DIM;
        newHeight = MAX_DIM / aspectRatio;
      } else {
        newHeight = MAX_DIM;
        newWidth = MAX_DIM * aspectRatio;
      }
      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.imageSmoothingQuality = "low";
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      setIsLoading(true);
      setAnalysisCount((prev) => prev + 1);

      canvas.toBlob(
        async (blob) => {
          if (!blob) throw new Error("Failed to create image blob");
          const { events: newEvents } = await detectEvents(blob);

          const eventsWithTimestamp = newEvents.map((event) => ({
            ...event,
            timestamp: new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          }));

          if (eventsWithTimestamp.some((e) => e.isDangerous)) {
            playSound();
          }

          setEvents((prev) => [...eventsWithTimestamp, ...prev].slice(0, 10));
          setError(null);
          onError(null);
          setIsLoading(false);
        },
        "image/jpeg",
        0.6,
      );
    } catch (err) {
      console.error("Error analyzing frame:", err);
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to analyze frame: ${msg}`);
      onError(`Failed to analyze frame: ${msg}`);
      setIsLoading(false);
    }
  }, [isAnalyzing, playSound, onError]);

  const startAnalysis = () => {
    if (!ipAddress) {
      const msg = "Please enter an IP address with port.";
      setError(msg);
      onError(msg);
      return;
    }

    setIsConnecting(true);
    setError(null);

    const baseUrl = ipAddress.startsWith("http://")
      ? ipAddress
      : `http://${ipAddress}`;
    const possible = [
      `${baseUrl}/video`,
      `${baseUrl}/stream`,
      `${baseUrl}/mjpg/video.mjpg`,
      `${baseUrl}:8080/video`,
      `${baseUrl}:8080/stream`,
      `${baseUrl}:8080/mjpg/video.mjpg`,
    ];

    (async () => {
      for (const url of possible) {
        try {
          const ctrl = new AbortController();
          const id = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
          clearTimeout(id);
          if (res.ok) {
            setStreamUrl(url);
            setVideoUrl(url);
            onWatchUrlChange(baseUrl);
            setIsAnalyzing(true);
            setError(null);
            onError(null);
            setStreamKey((k) => k + 1);
            setIsConnecting(false);
            return;
          }
        } catch {
          // ignore
        }
      }
      setIsConnecting(false);
      const msg = "Could not find a valid video stream. Please check the IP.";
      setError(msg);
      onError(msg);
    })();
  };

  const stopAnalysis = () => {
    setIsAnalyzing(false);
    stopSound();
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const resolveEvent = (i: number) => {
    const arr = [...events];
    arr.splice(i, 1);
    setEvents(arr);
    if (!arr.some((e) => e.isDangerous)) stopSound();
  };

  const reloadStream = () => setStreamKey((k) => k + 1);

  useEffect(() => {
    if (isAnalyzing) {
      intervalRef.current = setInterval(
        captureAndAnalyzeFrame,
        analysisInterval,
      );
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAnalyzing, captureAndAnalyzeFrame, analysisInterval]);

  return (
    <div className="flex h-full space-x-6">
      <div className="relative w-3/4">
        <Card className="flex h-full flex-col border  bg-black shadow-sm">
          <CardHeader className=" bg-black pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <ShieldCheck className="mr-3 h-5 w-5 text-white 600" />
                <CardTitle className="text-2xl font-bold tracking-tight text-white">
                  AI-Powered Surveillance
                </CardTitle>
              </div>

              <div className="flex items-center space-x-3">
                {isAnalyzing && (
                  <Badge className="flex items-center border-none bg-green-100 text-green-800">
                    <div className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500"></div>
                    System Active
                  </Badge>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                  className="border-blue-200 text-white 600 hover:bg-black"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative flex-grow p-4">
            {showSettings && (
              <div className="mb-4 rounded-lg border border-blue-100 bg-black p-4">
                <h3 className="mb-2 text-sm font-medium text-white 800">
                  Analysis Settings
                </h3>
                <div className="flex items-center gap-4">
                  <div className="flex flex-1 flex-col">
                    <label className="mb-1 text-xs text-white 700">
                      Analysis Frequency (ms)
                    </label>
                    <Input
                      type="number"
                      min="500"
                      max="10000"
                      step="500"
                      value={analysisInterval}
                      onChange={(e) =>
                        setAnalysisInterval(Number(e.target.value))
                      }
                      className="border-blue-200 bg-black text-sm text-gray-800 focus:border-blue-400 focus:ring-blue-400"
                    />
                  </div>

                  <div className="flex flex-1 flex-col">
                    <label className="mb-1 text-xs text-white 700">
                      Analysis Count
                    </label>
                    <div className="rounded-md border border-blue-200 bg-black px-3 py-2 text-sm text-gray-700">
                      {analysisCount} frames
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="mb-4 flex flex-col gap-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Camera IP Address (192.168.1.3:8080/video)"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="flex-grow border-gray-300 text-gray-800 focus:border-blue-400 focus:ring-blue-400"
                />

                <Button
                  onClick={startAnalysis}
                  disabled={isAnalyzing || isConnecting}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{" "}
                      Connecting...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="mr-2 h-4 w-4" /> Start Analysis
                    </>
                  )}
                </Button>

                <Button
                  onClick={stopAnalysis}
                  disabled={!isAnalyzing}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <StopIcon className="mr-2 h-4 w-4" /> Stop
                </Button>
              </div>
            </div>

            <div className="relative h-[calc(100vh-270px)] overflow-hidden rounded-lg border  bg-black shadow-sm">
              {isAnalyzing ? (
                <div className="relative h-full w-full">
                  <img
                    key={streamKey}
                    ref={imgRef}
                    src={`${videoUrl}?${streamKey}`}
                    alt="Live Camera Stream"
                    crossOrigin="anonymous"
                    className="h-full w-full object-contain"
                    onError={() => {
                      setError(`Failed to load video stream from ${videoUrl}`);
                      stopAnalysis();
                    }}
                  />
                  <Button
                    onClick={reloadStream}
                    className="absolute right-2 top-2 bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                  >
                    <RefreshCwIcon className="mr-2 h-4 w-4" /> Reload Stream
                  </Button>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center bg-black">
                  <div className="rounded-full bg-black p-6">
                    <CameraIcon className="h-16 w-16 text-white" />
                  </div>
                  <p className="mt-4 text-gray-600">
                    Enter camera IP address to begin analysis
                  </p>
                </div>
              )}

              {isAnalyzing && isLoading && (
                <div className="absolute right-2 top-12">
                  <Badge className="animate-pulse bg-blue-100 text-white 800">
                    <RefreshCwIcon className="mr-1 h-3 w-3 animate-spin" />
                    Analyzing...
                  </Badge>
                </div>
              )}

              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm">
                  <div className="w-2/3 rounded-lg border border-red-200 bg-black p-6 shadow-lg">
                    <div className="mb-4 flex items-center">
                      <AlertCircle className="mr-3 h-6 w-6 text-red-500" />
                      <h3 className="text-lg font-bold text-red-600">
                        Stream Error
                      </h3>
                    </div>
                    <p className="mb-4 text-gray-700">{error}</p>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => setError(null)}
                        variant="outline"
                        className="border-red-200 text-red-600 hover:bg-red-50"
                      >
                        Dismiss
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>
      <NotificationPanel events={events} onResolveEvent={resolveEvent} />
    </div>
  );
};
