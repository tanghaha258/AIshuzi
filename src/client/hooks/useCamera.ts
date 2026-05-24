import { useEffect, useRef, useState } from "react";

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [status, setStatus] = useState<"idle" | "active" | "blocked">("idle");

  useEffect(() => {
    if (!enabled) {
      streamRef.current = undefined;
      setStatus("idle");
      return undefined;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked");
      return undefined;
    }
    let stream: MediaStream | undefined;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        streamRef.current = mediaStream;
        setStatus("active");
      })
      .catch(() => {
        if (!cancelled) setStatus("blocked");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      streamRef.current = undefined;
    };
  }, [enabled]);

  useEffect(() => {
    if (status === "active" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  return { videoRef, status };
}
