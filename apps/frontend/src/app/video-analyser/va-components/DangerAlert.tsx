import React, { useState, useEffect } from "react";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoEvent } from "../actions";

interface DangerAlertProps {
  event: VideoEvent;
  onResolve: () => void;
}

export const DangerAlert: React.FC<DangerAlertProps> = ({
  event,
  onResolve,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animating, setAnimating] = useState(true);

  // Stop animating after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  const dangerColor = event.isDangerous
    ? "border-red-800 bg-gradient-to-r from-red-950/70 to-red-900/50"
    : "border-green-800 bg-gradient-to-r from-green-950/70 to-green-900/50";

  const Icon = event.isDangerous ? AlertTriangleIcon : CheckCircleIcon;

  return (
    <div
      className={`rounded-lg border shadow-md ${dangerColor} mb-3 overflow-hidden transition-all duration-300`}
    >
      <div
        className={`p-3 cursor-pointer flex items-center justify-between ${animating && event.isDangerous ? "animate-pulse" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center">
          <div
            className={`p-2 rounded-full ${event.isDangerous ? "bg-red-900/50" : "bg-green-900/50"}`}
          >
            <Icon
              className={`h-5 w-5 ${event.isDangerous ? "text-red-400" : "text-green-400"}`}
            />
          </div>
          <div className="ml-3">
            <p
              className={`text-sm font-medium ${event.isDangerous ? "text-red-200" : "text-green-200"}`}
            >
              {event.description}
            </p>
            <div className="flex items-center mt-1 text-xs text-gray-400">
              <Clock className="h-3 w-3 mr-1" />
              {event.timestamp}
            </div>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1">
          <div
            className={`text-xs mb-3 ${event.isDangerous ? "text-red-300" : "text-green-300"}`}
          >
            <p className="mb-1">
              Confidence level: {(Math.random() * 30 + 70).toFixed(1)}%
            </p>
            <p>
              Location: {event.isDangerous ? "Main Entrance" : "Storage Area"}
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              className={`
                border-gray-600 bg-gray-800/80 text-gray-300 hover:bg-gray-700
                flex items-center text-xs
              `}
            >
              <XCircleIcon className="mr-1 h-3 w-3" /> Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
