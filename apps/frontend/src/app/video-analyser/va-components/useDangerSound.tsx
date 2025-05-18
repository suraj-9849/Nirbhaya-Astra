import { useEffect, useRef, useState } from "react";

export const useDangerSound = (audioSrc: string) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio(audioSrc);

    if (audioRef.current) {
      audioRef.current.loop = true;
      audioRef.current.volume = volume;

      // Gradually increase volume when played
      audioRef.current.addEventListener("play", () => {
        let currentVolume = 0;
        const fadeIn = setInterval(() => {
          currentVolume += 0.1;
          if (currentVolume >= volume) {
            currentVolume = volume;
            clearInterval(fadeIn);
          }
          if (audioRef.current) {
            audioRef.current.volume = currentVolume;
          }
        }, 100);
      });
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioSrc, volume]);

  const playSound = () => {
    if (audioRef.current && !isPlaying) {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => console.error("Failed to play alert sound:", err));
    }
  };

  const stopSound = () => {
    if (audioRef.current) {
      // Fade out effect
      const fadeOut = setInterval(() => {
        if (!audioRef.current) {
          clearInterval(fadeOut);
          return;
        }

        if (audioRef.current.volume > 0.1) {
          audioRef.current.volume -= 0.1;
        } else {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          audioRef.current.volume = volume; // Reset volume for next play
          setIsPlaying(false);
          clearInterval(fadeOut);
        }
      }, 50);
    }
  };

  const setAudioVolume = (newVolume: number) => {
    setVolume(Math.min(1, Math.max(0, newVolume)));
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  return { playSound, stopSound, isPlaying, setVolume: setAudioVolume };
};
