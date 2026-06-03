import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "blocked";

export type CameraFailureReason =
  | "unsupported"
  | "permission-denied"
  | "device-busy"
  | "not-found"
  | "unknown";

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId?: string;
}

function mapCameraFailure(cause: unknown): CameraFailureReason {
  if (cause instanceof DOMException) {
    if (cause.name === "NotAllowedError" || cause.name === "SecurityError") {
      return "permission-denied";
    }
    if (cause.name === "NotFoundError" || cause.name === "DevicesNotFoundError" || cause.name === "OverconstrainedError") {
      return "not-found";
    }
    if (cause.name === "NotReadableError" || cause.name === "TrackStartError") {
      return "device-busy";
    }
  }

  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (/busy|in use|could not start|notreadable/.test(message)) return "device-busy";
  if (/permission|denied|notallowed|security/.test(message)) return "permission-denied";
  if (/not found|notfound|overconstrained/.test(message)) return "not-found";
  return "unknown";
}

function stopStream(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function useCamera(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [failureReason, setFailureReason] = useState<CameraFailureReason | undefined>(undefined);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return [];
    }

    const mediaDevices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = mediaDevices
      .filter((device) => device.kind === "videoinput" && Boolean(device.deviceId))
      .map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${index + 1}`,
        groupId: device.groupId || undefined
      }));

    setDevices(videoDevices);
    if (selectedDeviceId && !videoDevices.some((device) => device.deviceId === selectedDeviceId)) {
      setSelectedDeviceId("");
    }
    return videoDevices;
  }, [selectedDeviceId]);

  useEffect(() => {
    void refreshDevices().catch(() => undefined);
  }, [refreshDevices]);

  useEffect(() => {
    if (!enabled) {
      stopStream(streamRef.current);
      streamRef.current = undefined;
      setStatus("idle");
      setFailureReason(undefined);
      return undefined;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("blocked");
      setFailureReason("unsupported");
      return undefined;
    }
    let stream: MediaStream | undefined;
    let cancelled = false;
    const video: MediaTrackConstraints | boolean = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId } }
      : true;

    setStatus("requesting");
    setFailureReason(undefined);
    navigator.mediaDevices
      .getUserMedia({ video, audio: false })
      .then((mediaStream) => {
        if (cancelled) {
          stopStream(mediaStream);
          return;
        }
        stream = mediaStream;
        streamRef.current = mediaStream;
        setStatus("active");
        setFailureReason(undefined);
        void refreshDevices().catch(() => undefined);
      })
      .catch((cause) => {
        if (!cancelled) {
          setStatus("blocked");
          setFailureReason(mapCameraFailure(cause));
        }
      });

    return () => {
      cancelled = true;
      stopStream(stream);
      streamRef.current = undefined;
    };
  }, [enabled, selectedDeviceId, refreshDevices]);

  useEffect(() => {
    if (status === "active" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status, selectedDeviceId]);

  return {
    videoRef,
    status,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    failureReason
  };
}
