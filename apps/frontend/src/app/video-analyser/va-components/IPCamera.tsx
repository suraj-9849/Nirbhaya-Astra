import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CameraIcon, Wifi, RefreshCw, AlertTriangle } from "lucide-react";
import { NotificationPanel } from "./NotificationPanel";

export const IPCamera: React.FC = () => {
  const [ipAddress, setIpAddress] = useState<string>("");
  const [cameraUrl, setCameraUrl] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const handleStartCamera = () => {
    if (!ipAddress) {
      setConnectionError("Please enter a valid IP address");
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    // Simulate connection attempt
    setTimeout(() => {
      const formattedUrl = ipAddress.startsWith("http")
        ? ipAddress
        : `http://${ipAddress}`;
      setCameraUrl(formattedUrl);
      setIsConnecting(false);
    }, 1000);
  };

  const handleImgError = () => {
    setConnectionError("Failed to connect to camera stream");
    setCameraUrl("");
  };

  return (
    <div className="flex h-full space-x-6">
      <div className="relative w-3/4">
        <Card className="flex h-full flex-col border border-gray-200 bg-white shadow-sm">
          <CardHeader className="border-b border-gray-100 bg-white pb-4">
            <div className="flex items-center">
              <Wifi className="mr-3 h-5 w-5 text-blue-600" />
              <CardTitle className="text-2xl font-bold tracking-tight text-gray-800">
                IP Camera Viewer
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative flex-grow p-4">
            <div className="mb-4 flex flex-col gap-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Camera IP Address (http://example.com/video)"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  className="flex-grow border-gray-300 text-gray-800 focus:border-blue-400 focus:ring-blue-400"
                />
                <Button
                  onClick={handleStartCamera}
                  disabled={isConnecting}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CameraIcon className="mr-2 h-4 w-4" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
            </div>
            <div className="relative h-[calc(100vh-250px)] overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-inner">
              {cameraUrl ? (
                <img
                  src={cameraUrl}
                  alt="IP Camera Stream"
                  crossOrigin="anonymous"
                  className="h-full w-full object-contain"
                  onError={handleImgError}
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center">
                  <div className="rounded-full bg-blue-100 p-6">
                    <CameraIcon className="h-16 w-16 text-blue-600" />
                  </div>
                  <p className="mt-4 text-gray-600">
                    Enter camera address and connect
                  </p>
                </div>
              )}

              {connectionError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                  <div className="rounded-lg border border-red-200 bg-white p-6 text-center shadow-lg">
                    <AlertTriangle className="mx-auto mb-2 h-12 w-12 text-red-500" />
                    <p className="text-lg font-bold text-red-600">
                      Connection Error
                    </p>
                    <p className="mt-2 text-gray-700">{connectionError}</p>
                    <Button
                      onClick={() => setConnectionError(null)}
                      variant="outline"
                      className="mt-4 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <NotificationPanel events={[]} onResolveEvent={() => {}} />
    </div>
  );
};
