import { useEffect, useRef, useState, type RefObject } from "react";
import type { TeacherObservationPayload } from "../../shared/types";
import { deriveTeacherObservation, type FaceCenter } from "../utils/teacherVision";

export type TeacherVisionStatus = "idle" | "loading" | "analyzing" | "error";

export interface TeacherVisionSnapshot {
  payload: TeacherObservationPayload;
}

const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const modelPath = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function useTeacherVision(enabled: boolean, videoRef: RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<TeacherVisionStatus>("idle");
  const [latest, setLatest] = useState<TeacherVisionSnapshot | undefined>();
  const [error, setError] = useState("");
  const previousCenterRef = useRef<FaceCenter | undefined>(undefined);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      setLatest(undefined);
      setError("");
      previousCenterRef.current = undefined;
      return undefined;
    }

    let cancelled = false;
    let intervalId: number | undefined;
    let closeDetector: (() => void) | undefined;

    async function initialize() {
      setStatus("loading");
      setError("");
      try {
        const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        const detector = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelPath },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        if (cancelled) {
          detector.close();
          return;
        }

        closeDetector = () => detector.close();
        let samplingFailed = false;
        const sample = () => {
          const video = videoRef.current;
          if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
          try {
            const observation = deriveTeacherObservation(
              detector.detectForVideo(video, performance.now()),
              new Date().toISOString(),
              previousCenterRef.current
            );
            previousCenterRef.current = observation.faceCenter;
            setLatest({ payload: observation.payload });
            setStatus("analyzing");
          } catch (cause) {
            samplingFailed = true;
            if (intervalId) window.clearInterval(intervalId);
            setStatus("error");
            setError(cause instanceof Error ? cause.message : "教师视觉分析失败。");
          }
        };

        sample();
        if (!samplingFailed) {
          intervalId = window.setInterval(sample, 3500);
        }
      } catch (cause) {
        if (cancelled) return;
        setStatus("error");
        setError(cause instanceof Error ? cause.message : "教师视觉模型加载失败。");
      }
    }

    void initialize();
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      closeDetector?.();
      previousCenterRef.current = undefined;
    };
  }, [enabled, videoRef]);

  return { status, latest, error };
}
