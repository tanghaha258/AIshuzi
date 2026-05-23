import { useEffect, useRef, useState } from "react";

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<"idle" | "active" | "blocked">("idle");

  useEffect(() => {
    if (!enabled) return undefined;
    let stream: MediaStream | undefined;
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: false })
      .then((mediaStream) => {
        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStatus("active");
      })
      .catch(() => setStatus("blocked"));

    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);

  return { videoRef, status };
}
