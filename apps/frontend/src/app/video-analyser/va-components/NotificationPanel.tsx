import React from "react";
import { AlertTriangleIcon, BellIcon } from "lucide-react";
import { DangerAlert } from "./DangerAlert";
import { VideoEvent } from "../actions";

interface NotificationPanelProps {
  events: VideoEvent[];
  onResolveEvent: (index: number) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  events,
  onResolveEvent,
}) => {
  const dangerCount = events.filter((e) => e.isDangerous).length;

  return (
    <div className="w-1/4 overflow-hidden flex flex-col border  bg-black shadow-sm rounded-lg">
      <div className="p-4 border-b  bg-black">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center text-xl font-bold text-white">
            <BellIcon className="mr-2 text-blue-600" />
            Event Log
          </h2>
          {dangerCount > 0 && (
            <div className="flex items-center">
              <div className="animate-pulse p-1 px-2 bg-red-100 rounded text-xs font-bold text-red-600 flex items-center">
                <AlertTriangleIcon className="mr-1 h-3 w-3" />
                {dangerCount}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-black">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="rounded-full p-4 bg-blue-100">
              <BellIcon className="h-8 w-8 text-blue-600" />
            </div>
            <p className="mt-4 text-gray-600 font-medium">No events detected</p>
            <p className="text-xs text-gray-500 mt-2">
              Events will appear here when detected
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event, index) => (
              <DangerAlert
                key={index}
                event={event}
                onResolve={() => onResolveEvent(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
