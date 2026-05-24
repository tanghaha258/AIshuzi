import { MonitorPlay, Sparkles } from "lucide-react";
import type { LessonPlan, StudentAgent } from "../../../shared/types";

interface LessonPlanPanelProps {
  lessonPlan: LessonPlan;
  students: StudentAgent[];
  usedModel: boolean;
  fallbackReason: string;
  canStart: boolean;
  onStart: () => void;
}

export function LessonPlanPanel({
  lessonPlan,
  students,
  usedModel,
  fallbackReason,
  canStart,
  onStart
}: LessonPlanPanelProps) {
  const studentNameById = new Map(students.map((student) => [student.id, student.name]));
  const recommendedNames = lessonPlan.recommendedStudentIds
    .map((id) => studentNameById.get(id))
    .filter(Boolean)
    .join("、");

  return (
    <article className="lesson-plan-panel">
      <div className="lesson-plan-panel__header">
        <div>
          <span className="eyebrow">Generated Script</span>
          <h2>{lessonPlan.title}</h2>
        </div>
        <span className={usedModel ? "source-pill source-pill--model" : "source-pill"}>
          <Sparkles size={14} />
          {usedModel ? "DeepSeek" : "本地模拟"}
        </span>
      </div>

      <p>{lessonPlan.overview}</p>

      <div className={usedModel ? "ai-generation-status ai-generation-status--model" : "ai-generation-status"}>
        {usedModel ? "DeepSeek 已生成" : `已切换本地模拟：${fallbackReason || "未启用真实模型"}`}
      </div>

      <div className="lesson-plan-objectives">
        {lessonPlan.objectives.map((objective) => (
          <span key={objective}>{objective}</span>
        ))}
      </div>

      <div className="lesson-stage-table">
        <table>
          <thead>
            <tr>
              <th>阶段</th>
              <th>分钟</th>
              <th className="lesson-stage-table--method">教师教法</th>
              <th>教师动作</th>
              <th className="lesson-stage-table--script">具体做法/话术</th>
              <th>学生反应</th>
              <th>策略</th>
            </tr>
          </thead>
          <tbody>
            {lessonPlan.stages.map((stage) => (
              <tr key={stage.id}>
                <td>
                  <span className="stage-type-pill">{stage.type}</span>
                  <strong>{stage.name}</strong>
                </td>
                <td>{stage.minutes}</td>
                <td className="lesson-stage-table--method">{stage.teachingMethod}</td>
                <td>{stage.teacherAction}</td>
                <td className="lesson-stage-table--script">{stage.actionScript}</td>
                <td>{stage.expectedStudentResponse}</td>
                <td>{stage.strategyTip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="incident-grid">
        {lessonPlan.incidents.map((incident) => (
          <div className="incident-card" key={incident.id}>
            <strong>{incident.type}</strong>
            <span>{incident.studentRole}</span>
            <p>{incident.trigger}</p>
            <small>{incident.teacherStrategy}</small>
          </div>
        ))}
      </div>

      <div className="planner-actions">
        <span className="recommended-line">推荐学生：{recommendedNames || "暂未匹配"}</span>
        <button className="primary-button" type="button" disabled={!canStart} onClick={onStart}>
          <MonitorPlay size={17} />
          用该脚本进入试讲室
        </button>
      </div>
    </article>
  );
}
