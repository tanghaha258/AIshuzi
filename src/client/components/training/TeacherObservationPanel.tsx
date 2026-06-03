import { ScanFace } from "lucide-react";
import type { TeacherObservationHeadDirection, TeacherObservationPayload } from "../../../shared/types";
import type { TeacherVisionStatus } from "../../hooks/useTeacherVision";

export type TeacherObservationSaveState = "idle" | "saving" | "saved" | "error";

interface TeacherObservationPanelProps {
  status: TeacherVisionStatus;
  observation?: TeacherObservationPayload;
  recording: boolean;
  error?: string;
  observationSaveState: TeacherObservationSaveState;
  lastObservationSavedAt?: string;
}

function statusLabel(status: TeacherVisionStatus, recording: boolean) {
  if (!recording) return "待开启";
  if (status === "loading") return "模型加载中";
  if (status === "analyzing") return "本地观察中";
  if (status === "error") return "观察不可用";
  return "待取样";
}

function headDirectionLabel(direction: TeacherObservationHeadDirection) {
  const labels: Record<TeacherObservationHeadDirection, string> = {
    front: "正向",
    left: "偏左",
    right: "偏右",
    up: "偏上",
    down: "偏下",
    unknown: "未识别"
  };
  return labels[direction];
}

function sampleTimeLabel(observation?: TeacherObservationPayload) {
  if (!observation) return "暂无";
  const capturedAt = new Date(observation.capturedAt);
  if (!Number.isFinite(capturedAt.getTime())) return "暂无";
  return capturedAt.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function calibrationLabel(
  status: TeacherVisionStatus,
  recording: boolean,
  observation?: TeacherObservationPayload
) {
  if (!recording) return "待开启";
  if (status === "loading") return "模型加载中";
  if (status === "error") return "模型不可用";
  if (!observation) return "等待采样";
  if (!observation.faceVisible || observation.faceConfidence < 35) return "光线不足或遮挡";
  if (observation.headDirection !== "front") return "脸部偏离画面";
  if (observation.stability < 35) return "画面不稳定";
  return "画面正常";
}

function calibrationTone(label: string) {
  if (label === "画面正常") return "good";
  if (label === "待开启" || label === "等待采样" || label === "模型加载中") return "idle";
  return "warning";
}

function saveStateLabel(state: TeacherObservationSaveState, lastObservationSavedAt?: string) {
  if (state === "saving") return "入库中";
  if (state === "error") return "入库失败";
  if (state === "saved" && lastObservationSavedAt) {
    const savedAt = new Date(lastObservationSavedAt);
    const label = Number.isFinite(savedAt.getTime())
      ? savedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "刚刚";
    return `已入库 ${label}`;
  }
  if (state === "saved") return "已入库";
  return "等待入库";
}

export function TeacherObservationPanel({
  status,
  observation,
  recording,
  error,
  observationSaveState,
  lastObservationSavedAt
}: TeacherObservationPanelProps) {
  const calibration = calibrationLabel(status, recording, observation);

  return (
    <div className="teacher-observation-panel screen-card">
      <div className="screen-card__title">
        <span><ScanFace size={16} /> 教师观察</span>
        <span className={`teacher-observation-status teacher-observation-status--${status}`}>
          {statusLabel(status, recording)}
        </span>
      </div>
      <div className={`teacher-observation-calibration teacher-observation-calibration--${calibrationTone(calibration)}`}>
        <strong>{calibration}</strong>
        <span>现场校准</span>
      </div>
      {observation ? (
        <div className="teacher-observation-grid">
          <div>
            <strong>{observation.faceVisible ? "已识别" : "未识别"}</strong>
            <span>面部</span>
          </div>
          <div>
            <strong>{headDirectionLabel(observation.headDirection)}</strong>
            <span>朝向</span>
          </div>
          <div>
            <strong>{observation.expressionActivity}%</strong>
            <span>表情活跃</span>
          </div>
          <div>
            <strong>{observation.stability}%</strong>
            <span>稳定度</span>
          </div>
        </div>
      ) : (
        <div className="teacher-observation-empty">等待观察数据</div>
      )}
      <div className="teacher-observation-meta">
        <span>
          <strong>{sampleTimeLabel(observation)}</strong>
          <small>采样时间</small>
        </span>
        <span>
          <strong>{observation ? `${observation.faceConfidence}%` : "暂无"}</strong>
          <small>识别置信度</small>
        </span>
        <span>
          <strong>{saveStateLabel(observationSaveState, lastObservationSavedAt)}</strong>
          <small>最近入库</small>
        </span>
      </div>
      {error ? <p className="teacher-observation-error">{error || "模型未就绪，摄像头预览仍可继续使用。"}</p> : null}
      <small className="teacher-observation-local">本地分析，仅记录指标</small>
    </div>
  );
}
