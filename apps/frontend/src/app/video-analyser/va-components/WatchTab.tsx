import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, AlertCircle } from "lucide-react";

interface WatchTabProps {
  watchUrl?: string;
}

export const WatchTab: React.FC<WatchTabProps> = ({ watchUrl }) => {
  return (
    <Card className="h-full border  bg-black shadow-sm">
      <CardHeader className="border-b  bg-black pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Video className="mr-3 h-5 w-5 text-blue-600" />
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-800">
              Live Surveillance
            </CardTitle>
          </div>
          {watchUrl && (
            <div className="flex items-center">
              <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-red-500"></div>
              <span className="text-xs font-medium text-gray-600">LIVE</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[calc(100vh-180px)] w-full">
          {watchUrl ? (
            <iframe
              src={watchUrl}
              className="h-full w-full rounded-b-lg shadow-inner"
              allowFullScreen
            ></iframe>
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-black">
              <AlertCircle className="mb-4 h-16 w-16 text-blue-300" />
              <p className="text-lg font-medium text-gray-600">
                No active stream
              </p>
              <p className="mt-2 text-sm text-white">
                Connect to a camera in the Analyze tab first
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
