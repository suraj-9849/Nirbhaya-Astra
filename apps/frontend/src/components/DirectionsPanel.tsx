// src/components/DirectionsPanel.tsx

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "./ui/button";
import {
  MapPin,
  Navigation,
  Clock,
  ArrowRight,
  ChevronRight,
  Shield,
} from "lucide-react";

interface Location {
  lat: number;
  lng: number;
  address?: string;
}

interface RouteInfo {
  distance: string;
  duration: string;
  steps: google.maps.DirectionsStep[];
}

interface DirectionsPanelProps {
  routeInfo: RouteInfo | null;
  safetyScore?: number;
  destination: Location | null;
}

export const DirectionsPanel: React.FC<DirectionsPanelProps> = ({
  routeInfo,
  safetyScore,
  destination,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleSpeakDirections = () => {
    if (!routeInfo || !routeInfo.steps) {
      alert("No directions available to read.");
      return;
    }

    // Cancel any ongoing speech before starting
    window.speechSynthesis.cancel();

    const steps = routeInfo.steps.map(
      (step, index) =>
        `Step ${index + 1}: ${step.instructions.replace(/<[^>]+>/g, "")}`,
    );

    let currentStep = 0;

    const speakStep = () => {
      if (currentStep >= steps.length) {
        setIsSpeaking(false);
        return;
      }

      const speech = new SpeechSynthesisUtterance();
      speech.text = steps[currentStep];
      speech.lang = "en-US";
      speech.rate = 1; // Adjust the rate if needed
      speech.pitch = 1;

      // Attempt to use a female voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find((voice) => voice.name.includes("Female"));
      if (femaleVoice) {
        speech.voice = femaleVoice;
      }

      // Handle speech end event to queue the next step
      speech.onend = () => {
        currentStep++;
        setTimeout(speakStep, 500); // Add a 500ms pause between steps
      };

      // Handle speech errors
      speech.onerror = (event) => {
        console.error("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        alert(
          "An error occurred while reading the directions. Please try again.",
        );
      };

      // Start speaking the current step
      window.speechSynthesis.speak(speech);
    };

    setIsSpeaking(true);
    speakStep();
  };

  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  if (!destination || !routeInfo) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Navigation className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">
            Enter a destination to see directions
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            We&aposll show you the safest route to get there
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Route Overview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle>Route Overview</CardTitle>
              <p className="text-sm text-muted-foreground">
                {destination.address}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {safetyScore && (
                <Badge
                  variant={safetyScore > 70 ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  <Shield className="h-3 w-3" />
                  {safetyScore}% Safe
                </Badge>
              )}
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {routeInfo.duration}
              </Badge>
              <Badge variant="outline" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {routeInfo.distance}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {routeInfo.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1">
                  {index === 0 ? (
                    <ArrowRight className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: step.instructions }}
                  />
                  <p className="text-sm text-muted-foreground">
                    {step.distance?.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4">
            <Button onClick={handleSpeakDirections} disabled={isSpeaking}>
              {isSpeaking ? "Speaking..." : "Play Directions"}
            </Button>
            <Button
              onClick={handleStopSpeaking}
              variant="destructive"
              disabled={!isSpeaking}
            >
              Stop Speaking
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
