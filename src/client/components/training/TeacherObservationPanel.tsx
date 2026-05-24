import { ScanFace } from "lucide-react";
import type { TeacherObservationHeadDirection, TeacherObservationPayload } from "../../../shared/types";
import type { TeacherVisionStatus } from "../../hooks/useTeacherVision";

interface TeacherObservationPanelProps {
  status: TeacherVisionStatus;
  observation?: TeacherObservationPayload;
  recording: boolean;
  error?: string;
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

export function TeacherObservationPanel({
  status,
  observation,
  recording,
  error
}: TeacherObservationPanelProps) {
  return (
    <div className="teacher-observation-panel screen-card">
      <div className="screen-card__title">
        <span><ScanFace size={16} /> 教师观察</span>
        <span className={`teacher-observation-status teacher-observation-status--${status}`}>
          {statusLabel(status, recording)}
        </span>
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
      {error ? <p className="teacher-observation-error">模型未就绪，摄像头预览仍可继续使用。</p> : null}
      <small className="teacher-observation-local">本地分析，仅记录指标</small>
    </div>
  );
}
