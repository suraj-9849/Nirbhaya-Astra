"use client";

import type React from "react";
import { useState, useRef } from "react";
import {
  Upload,
  Search,
  AlertTriangle,
  Shield,
  Maximize2,
  X,
  Sparkles,
  Clock,
  Eye,
  ChevronRight,
  Flame,
  ArrowUpRight,
  Zap,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import VideoPlayer from "@/components/video-player";
import { detectEvents, type VideoEvent } from "./actions";
export interface Timestamp {
  timestamp: string;
  description: string;
  isDangerous: boolean;
}

export default function InvestigatePage() {
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [investigationPrompt, setInvestigationPrompt] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [timestamps, setTimestamps] = useState<Timestamp[]>([]);
  const [dangerousFrames, setDangerousFrames] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("timeline");
  const videoRef = useRef<HTMLVideoElement>(null);

  const captureFrame = async (
    video: HTMLVideoElement,
    time: number
  ): Promise<string | null> => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      console.error("Failed to get canvas context");
      return null;
    }

    try {
      video.currentTime = time;
    } catch (error) {
      console.error("Error setting video time:", error);
      return null;
    }

    await new Promise((resolve) => {
      video.onseeked = resolve;
    });

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.8);
  };

  const handleInvestigate = async () => {
    if (!videoUrl || !investigationPrompt) {
      alert("Please upload a video and provide an investigation prompt");
      return;
    }

    setIsAnalyzing(true);
    setTimestamps([]);
    setDangerousFrames([]);
    setUploadProgress(0);

    try {
      const video = document.createElement("video");
      video.src = videoUrl;

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(true);
        video.onerror = () => reject(new Error("Failed to load video"));
      });

      const duration = video.duration;
      if (!duration || duration === Infinity || isNaN(duration)) {
        throw new Error("Invalid video duration");
      }

      const interval = 3;
      const newTimestamps: Timestamp[] = [];
      const newDangerousFrames: string[] = [];

      for (let time = 0; time < duration; time += interval) {
        const progress = Math.floor((time / duration) * 100);
        setUploadProgress(progress);

        const frame = await captureFrame(video, time);
        if (frame) {
          try {
            const result = await detectEvents(frame, investigationPrompt);

            if (result.events && result.events.length > 0) {
              result.events.forEach((event: VideoEvent) => {
                const minutes = Math.floor(time / 60);
                const seconds = Math.floor(time % 60);
                const timestampStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

                newTimestamps.push({
                  timestamp: timestampStr,
                  description: event.description,
                  isDangerous: event.isDangerous,
                });

                if (event.isDangerous) {
                  newDangerousFrames.push(frame);
                }
              });
            }
          } catch (error) {
            console.error("Error analyzing frame:", error);
          }
        }
      }

      setTimestamps(newTimestamps);
      setDangerousFrames(newDangerousFrames);
      setIsAnalyzing(false);
      setUploadProgress(100);
    } catch (error) {
      console.error("Error analyzing video:", error);
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: {
    target: { files: FileList | null };
  }) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setVideoUrl(localUrl);
      setIsUploading(false);
    } catch (error) {
      console.error("Error uploading file:", error);
      setIsUploading(false);
    }
  };

  const handleTimestampClick = (timestamp: string) => {
    if (!videoRef.current) return;

    const [minutes, seconds] = timestamp.split(":").map(Number);
    const timeInSeconds = minutes * 60 + seconds;
    videoRef.current.currentTime = timeInSeconds;
    videoRef.current.play();
  };

  return (
    <div className="min-h-screen  p-8">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h1 className="mb-4 bg-black bg-clip-text text-6xl font-extrabold text-white">
            IntelliInvestigate
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-slate-600">
            Uncover hidden insights with AI-powered video investigation
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <Card className="group relative col-span-5 overflow-hidden rounded-3xl border shadow-xl backdrop-blur-lg transition-all duration-300 ">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl text-white">
                  <Upload className="mr-3 text-indigo-500" />
                  Video Input
                </CardTitle>
                {videoUrl && (
                  <Badge variant="outline" className=" text-white">
                    <Clock className="mr-1 h-3 w-3" /> Ready for Analysis
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 p-6">
              {/* Video Upload Area */}
              <div className="group relative min-h-52 rounded-2xl border-2 border-dashed  p-8 text-center transition-all duration-300 hover:border-indigo-300 hover:bg-indigo-50/30">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  id="video-upload"
                  onChange={handleFileUpload}
                  disabled={isUploading || isAnalyzing}
                />
                <label htmlFor="video-upload" className="block cursor-pointer">
                  {videoUrl ? (
                    <div className="relative rounded-xl overflow-hidden">
                      <VideoPlayer
                        url={videoUrl}
                        timestamps={timestamps}
                        ref={videoRef}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="mb-4 rounded-full bg-indigo-100 p-4 text-indigo-600 transition-all duration-300 group-hover:bg-indigo-200 group-hover:text-indigo-700">
                        <Upload className="h-12 w-12" />
                      </div>
                      <p className="text-lg font-medium text-slate-600">
                        Click to upload or drag and drop a video
                      </p>
                      <p className="mt-2 text-sm text-slate-400">
                        Supported formats: MP4, MOV, AVI
                      </p>
                    </div>
                  )}
                </label>
              </div>

              {/* Investigation Prompt */}
              <div className="space-y-4">
                <Textarea
                  placeholder="What behavior or object are you looking for? (e.g., 'Find students smoking in the hallway')"
                  value={investigationPrompt}
                  onChange={(e) => setInvestigationPrompt(e.target.value)}
                  className="min-h-28 resize-none rounded-xl border-slate-200 bg-black text-white placeholder:text-white focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                />

                <Button
                  onClick={handleInvestigate}
                  disabled={!videoUrl || !investigationPrompt || isAnalyzing}
                  className=" relative w-full overflow-hidden rounded-xl bg-black py-6 text-white"
                >
                  <span className="relative z-10 flex items-center justify-center">
                    {isAnalyzing ? (
                      <>
                        <Zap className="mr-2 animate-pulse" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2" />
                        Start Investigation
                      </>
                    )}
                  </span>
                  <span className="absolute bottom-0 left-0 h-1 w-full transform bg-white/20 transition-transform duration-700 ease-in-out group-hover:translate-y-0"></span>
                </Button>
              </div>

              {/* Progress Indicator */}
              {(isUploading || isAnalyzing) && (
                <div className="mt-4">
                  <Progress
                    value={uploadProgress}
                    className="h-3 w-full rounded-full bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-purple-500 [&>div]:rounded-full"
                  />
                  <p className="mt-2 text-center text-sm font-medium text-indigo-500">
                    {isUploading
                      ? "Uploading video..."
                      : `Analyzing content... ${uploadProgress}%`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="col-span-7 overflow-hidden rounded-3xl border  shadow-xl transition-all duration-300">
            <CardHeader className="border-b  pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center text-xl text-wghite">
                  <Shield className="mr-3 " />
                  Investigation Results
                </CardTitle>
                {timestamps.length > 0 && (
                  <Badge className="bg-black">
                    {timestamps.length} Findings
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {timestamps.length > 0 ? (
                <Tabs
                  value={activeTab}
                  onValueChange={setActiveTab}
                  className="w-full"
                >
                  <div className="border-b border-slate-100">
                    <TabsList className="flex h-14 w-full justify-start rounded-none bg-transparent p-0">
                      <TabsTrigger
                        value="timeline"
                        className="relative h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-6 text-slate-500 transition-all data-[state=active]:border-purple-500 data-[state=active]:text-purple-700"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Timeline
                      </TabsTrigger>
                      <TabsTrigger
                        value="gallery"
                        className="relative h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-6 text-slate-500 transition-all data-[state=active]:border-purple-500 data-[state=active]:text-purple-700"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Evidence Gallery{" "}
                        {dangerousFrames.length > 0 &&
                          `(${dangerousFrames.length})`}
                      </TabsTrigger>
                      <TabsTrigger
                        value="analytics"
                        className="relative h-full data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-6 text-slate-500 transition-all data-[state=active]:border-purple-500 data-[state=active]:text-purple-700"
                      >
                        <Flame className="mr-2 h-4 w-4" />
                        Analytics
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent
                    value="timeline"
                    className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                  >
                    <ScrollArea className="h-96 px-6 py-4">
                      <div className="relative pl-6 before:absolute before:left-0 before:top-3 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-indigo-200 before:via-purple-200 before:to-pink-200">
                        {timestamps.map((timestamp, index) => (
                          <div
                            key={index}
                            className="group relative mb-6 ml-6 cursor-pointer"
                            onClick={() =>
                              handleTimestampClick(timestamp.timestamp)
                            }
                          >
                            <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-gradient-to-br from-indigo-100 to-purple-100 shadow-md transition-all duration-300 group-hover:scale-110">
                              <span className="text-xs font-bold text-purple-700">
                                {index + 1}
                              </span>
                            </div>

                            <Card
                              className={`overflow-hidden transition-all duration-300 group-hover:shadow-md ${
                                timestamp.isDangerous
                                  ? "border-red-100 bg-black"
                                  : "border-slate-100 bg-black"
                              }`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="mb-2 flex items-center">
                                      <Badge
                                        className={`mr-2 ${
                                          timestamp.isDangerous
                                            ? "bg-gradient-to-r from-red-400 to-pink-500 text-white"
                                            : "bg-gradient-to-r from-indigo-400 to-purple-500 text-white"
                                        }`}
                                      >
                                        {timestamp.timestamp}
                                      </Badge>
                                      {timestamp.isDangerous && (
                                        <Badge
                                          variant="outline"
                                          className="border-red-200 bg-red-50 text-red-500"
                                        >
                                          <AlertTriangle className="mr-1 h-3 w-3" />{" "}
                                          Alert
                                        </Badge>
                                      )}
                                    </div>
                                    <p
                                      className={`text-sm ${timestamp.isDangerous ? "text-red-700" : "text-white"}`}
                                    >
                                      {timestamp.description}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className={`rounded-full p-2 ${
                                      timestamp.isDangerous
                                        ? "text-red-500 hover:bg-red-100 hover:text-red-600"
                                        : "text-purple-500 hover:bg-purple-100 hover:text-purple-600"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleTimestampClick(timestamp.timestamp);
                                    }}
                                  >
                                    <ChevronRight className="h-5 w-5" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent
                    value="gallery"
                    className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                  >
                    <div className="p-6">
                      {dangerousFrames.length > 0 ? (
                        <div className="grid grid-cols-2 gap-4">
                          {dangerousFrames.map((frame, index) => (
                            <div
                              key={index}
                              className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-100 transition-all duration-300 hover:shadow-lg"
                              onClick={() => setSelectedFrame(frame)}
                            >
                              <img
                                src={frame}
                                alt={`Suspicious Frame ${index + 1}`}
                                className="h-48 w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-purple-900/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                              <div className="absolute bottom-0 left-0 right-0 p-4 text-white opacity-0 transition-all duration-300 group-hover:bottom-0 group-hover:opacity-100">
                                <div className="flex items-center justify-between">
                                  <Badge className="bg-red-500 text-white">
                                    Frame {index + 1}
                                  </Badge>
                                  <Maximize2 className="h-5 w-5" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Alert className="border-indigo-100 bg-indigo-50/50">
                          <Eye className="h-5 w-5 text-indigo-500" />
                          <AlertTitle className="text-indigo-700">
                            No Suspicious Frames
                          </AlertTitle>
                          <AlertDescription className="text-indigo-600">
                            No potentially suspicious frames were detected in
                            this video.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="analytics"
                    className="mt-0 focus-visible:outline-none focus-visible:ring-0"
                  >
                    <div className="grid grid-cols-2 gap-4 p-6">
                      <Card className="overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 pb-2 pt-4">
                          <CardTitle className="text-sm font-medium text-indigo-700">
                            Event Distribution
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex items-center">
                            <div className="mr-4 h-16 w-16 rounded-full bg-indigo-100 p-4 text-indigo-500">
                              <Clock />
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-slate-800">
                                {timestamps.length}
                              </div>
                              <div className="text-sm text-slate-500">
                                Total timestamps found
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                              style={{
                                width: `${(timestamps.length / (timestamps.length + 5)) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="overflow-hidden">
                        <CardHeader className="bg-gradient-to-r from-red-50 to-pink-50 pb-2 pt-4">
                          <CardTitle className="text-sm font-medium text-red-700">
                            Security Alerts
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="flex items-center">
                            <div className="mr-4 h-16 w-16 rounded-full bg-red-100 p-4 text-red-500">
                              <AlertTriangle />
                            </div>
                            <div>
                              <div className="text-3xl font-bold text-slate-800">
                                {dangerousFrames.length}
                              </div>
                              <div className="text-sm text-slate-500">
                                Suspicious frames detected
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 h-2 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-red-500 to-pink-500"
                              style={{
                                width: `${(dangerousFrames.length / Math.max(timestamps.length, 1)) * 100}%`,
                              }}
                            ></div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="col-span-2 overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-4">
                          <CardTitle className="text-sm font-medium text-slate-700">
                            Investigation Summary
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className="bg-black text-white"
                          >
                            AI Generated
                          </Badge>
                        </CardHeader>
                        <CardContent className="p-4">
                          <p className="text-sm text-slate-600">
                            Analysis completed for "{investigationPrompt}".
                            {dangerousFrames.length > 0
                              ? ` Found ${dangerousFrames.length} instances of potential concern across ${timestamps.length} total events.`
                              : ` No suspicious activity detected across ${timestamps.length} analyzed events.`}
                          </p>
                          <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
                            <p className="flex items-center">
                              <ArrowUpRight className="mr-1 h-3 w-3" />
                              Recommendation:{" "}
                              {dangerousFrames.length > 0
                                ? "Review flagged moments and consider additional monitoring."
                                : "No action needed based on current findings."}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex flex-col items-center justify-center p-16 text-center">
                  <div className="mb-6 rounded-full bg-white p-6">
                    <Shield className="h-16 w-16 text-black" />
                  </div>
                  <h3 className="mb-2 text-xl font-medium text-white">
                    No Analysis Results Yet
                  </h3>
                  <p className="mb-6 max-w-md text-white">
                    Upload a video and provide an investigation prompt to start
                    analyzing your content
                  </p>
                  <div className="flex items-center justify-center rounded-full bg-black px-4 py-2 text-sm text-white">
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI-powered video investigation ready
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Full Screen Frame Modal */}
      <Dialog
        open={!!selectedFrame}
        onOpenChange={() => setSelectedFrame(null)}
      >
        <DialogContent className="max-w-6xl border-none bg-transparent p-0">
          <div className="relative overflow-hidden rounded-3xl bg-white p-1 backdrop-blur-xl">
            <img
              src={selectedFrame || ""}
              alt="Full Screen Frame"
              className="mx-auto max-h-[80vh] max-w-full rounded-2xl shadow-2xl"
            />
            <button
              onClick={() => setSelectedFrame(null)}
              className="absolute right-8 top-8 rounded-full bg-black/20 p-3 text-white transition-colors hover:bg-black/40"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="absolute bottom-8 left-8 rounded-xl bg-black/30 px-4 py-2 text-white backdrop-blur-md">
              <p className="text-sm font-medium">
                Suspicious Activity Detected
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
