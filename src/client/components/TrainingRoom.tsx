import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  CircleDot,
  Eraser,
  Loader2,
  Mic,
  MicOff,
  Play,
  Send,
  Square,
  VideoOff
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer
} from "recharts";
import { api } from "../api";
import { useCamera } from "../hooks/useCamera";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import { useTeacherVision } from "../hooks/useTeacherVision";
import { useTranscriptBuffer } from "../hooks/useTranscriptBuffer";
import { shouldSendTeacherTurnFromKey } from "../utils/teacherInput";
import type {
  ClassroomEvent,
  ClassroomMetrics,
  EvaluationReport,
  StudentAgent,
  StudentRuntimeState,
  TrainingTarget,
  TrainingSession
} from "../../shared/types";
import { StudentPortrait } from "./training/StudentPortrait";
import { TeacherObservationPanel } from "./training/TeacherObservationPanel";

interface TrainingRoomProps {
  session: TrainingSession;
  students: StudentAgent[];
  initialEvents: ClassroomEvent[];
  initialRuntimeStates: StudentRuntimeState[];
  trainingTarget?: TrainingTarget;
  onSessionChange: (session: TrainingSession) => void;
  onTrainingTargetChange?: (target: TrainingTarget) => void;
  onReport: (report: EvaluationReport) => void;
}

type StudentPose = "listening" | "smiling" | "thinking" | "confused" | "distracted" | "challenging";

const defaultMetrics: ClassroomMetrics = {
  attention: 68,
  confusion: 22,
  interaction: 55,
  pace: 74,
  clarity: 70,
  questioning: 48,
  engagement: 62
};

function metricColor(value: number, inverse = false) {
  if (inverse) {
    if (value > 55) return "danger";
    if (value > 32) return "warning";
    return "good";
  }
  if (value > 72) return "good";
  if (value > 48) return "warning";
  return "danger";
}

function inferStudentPose(student: StudentAgent, lastEvent?: ClassroomEvent): StudentPose {
  const text = `${student.status} ${student.personality} ${student.behaviorStyle} ${lastEvent?.content ?? ""}`;
  if (/质疑|挑战|为什么|如果|边界/.test(text)) return "challenging";
  if (/困惑|不懂|跟不上|不会|听不懂/.test(text)) return "confused";
  if (/走神|发呆|分心|沉默|低头/.test(text) || student.attention < 48) return "distracted";
  if (/举手|积极|抢答|主动|说得对/.test(text) || student.participation > 78) return "smiling";
  if (/思考|慢热|观察|等待|安静/.test(text) || student.comprehension < 55) return "thinking";
  return "listening";
}

function studentMoodLabel(pose: StudentPose) {
  switch (pose) {
    case "smiling":
      return "积极回应";
    case "thinking":
      return "认真思考";
    case "confused":
      return "有点困惑";
    case "distracted":
      return "注意力漂移";
    case "challenging":
      return "边界追问";
    default:
      return "专注倾听";
  }
}

function eventTypeLabel(type: ClassroomEvent["type"]) {
  switch (type) {
    case "teacher_utterance":
      return "教师发言";
    case "student_response":
      return "学生回应";
    case "student_question":
      return "学生提问";
    case "student_distraction":
      return "走神信号";
    case "student_state_change":
      return "状态变化";
    case "system_suggestion":
      return "教学建议";
    case "teacher_observation":
      return "教师观察";
    case "transcript_segment":
      return "语音转写";
    case "report_evidence":
      return "报告证据";
    default:
      return "课堂事件";
  }
}

function timelineStatus(event: ClassroomEvent) {
  const statusText = event.metadata?.statusText;
  if (typeof statusText === "string" && statusText) return statusText;
  const pose = event.metadata?.pose;
  if (typeof pose === "string") return studentMoodLabel(pose as StudentPose);
  if (event.type === "system_suggestion") return "建议已生成";
  if (event.type === "teacher_utterance") return "已记录";
  return "已同步";
}

function speechStatusLabel(status: ReturnType<typeof useSpeechRecognition>["status"]) {
  switch (status) {
    case "listening":
      return "正在连续转写";
    case "unsupported":
      return "浏览器不支持语音";
    case "blocked":
      return "麦克风权限未开启";
    case "error":
      return "语音识别异常";
    default:
      return "语音待命";
  }
}

export function TrainingRoom({
  session,
  students,
  initialEvents,
  initialRuntimeStates,
  trainingTarget,
  onSessionChange,
  onTrainingTargetChange,
  onReport
}: TrainingRoomProps) {
  const [events, setEvents] = useState<ClassroomEvent[]>(initialEvents);
  const [runtimeStates, setRuntimeStates] = useState<StudentRuntimeState[]>(initialRuntimeStates);
  const [teacherText, setTeacherText] = useState("");
  const [metrics, setMetrics] = useState<ClassroomMetrics>(() => {
    const lastMetric = [...initialEvents].reverse().find((event) => event.type === "classroom_metric");
    return lastMetric ? (lastMetric.metadata as unknown as ClassroomMetrics) : defaultMetrics;
  });
  const [submitting, setSubmitting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [observationError, setObservationError] = useState("");
  const [modelNotice, setModelNotice] = useState("本地模拟已待命");
  const { videoRef, status: cameraStatus } = useCamera(cameraEnabled);
  const vision = useTeacherVision(cameraEnabled && cameraStatus === "active", videoRef);
  const selectedStudents = students.filter((student) => session.selectedStudentIds.includes(student.id));
  const savedTranscriptIdsRef = useRef<Set<string>>(new Set());
  const lastSavedObservationRef = useRef<{ signature: string; capturedAt: number } | undefined>(undefined);
  const transcript = useTranscriptBuffer(session.id);
  const speech = useSpeechRecognition(transcript.acceptSegment);

  const appendEvents = useCallback((incoming: ClassroomEvent[]) => {
    setEvents((current) => {
      const existingIds = new Set(current.map((event) => event.id));
      const nextEvents = incoming.filter((event) => !existingIds.has(event.id));
      return nextEvents.length ? [...current, ...nextEvents] : current;
    });
  }, []);

  useEffect(() => {
    setEvents(initialEvents);
    savedTranscriptIdsRef.current = new Set(
      initialEvents
        .filter((event) => event.type === "transcript_segment")
        .map((event) => String(event.metadata.transcriptId ?? ""))
        .filter(Boolean)
    );
  }, [initialEvents, session.id]);

  useEffect(() => {
    setRuntimeStates(initialRuntimeStates);
  }, [initialRuntimeStates, session.id]);

  useEffect(() => {
    lastSavedObservationRef.current = undefined;
    setObservationError("");
  }, [session.id]);

  useEffect(() => {
    if (session.status !== "active") return undefined;
    let cancelled = false;
    const interval = window.setInterval(() => {
      api.tickSession(session.id)
        .then((result) => {
          if (cancelled) return;
          setRuntimeStates(result.runtimeStates);
          if (result.stateEvents.length) {
            appendEvents(result.stateEvents);
          }
        })
        .catch(() => undefined);
    }, 7000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [appendEvents, session.id, session.status]);

  useEffect(() => {
    const unsavedSegments = transcript.finalSegments.filter((segment) => {
      const id = segment.id ?? "";
      return id && !savedTranscriptIdsRef.current.has(id);
    });
    if (!unsavedSegments.length) return;

    unsavedSegments.forEach((segment) => segment.id && savedTranscriptIdsRef.current.add(segment.id));
    api.saveTranscriptSegments(session.id, { segments: unsavedSegments })
      .then((result) => {
        appendEvents(result.transcriptEvents);
      })
      .catch((error) => {
        unsavedSegments.forEach((segment) => segment.id && savedTranscriptIdsRef.current.delete(segment.id));
        transcript.setLastError(error instanceof Error ? error.message : "保存转写片段失败。");
      });
  }, [appendEvents, session.id, transcript, transcript.finalSegments]);

  useEffect(() => {
    const observation = vision.latest?.payload;
    if (!observation || session.status !== "active") return;

    const capturedAt = new Date(observation.capturedAt).getTime();
    const signature = [
      observation.faceVisible,
      observation.headDirection,
      Math.round(observation.expressionActivity / 10),
      Math.round(observation.stability / 10)
    ].join(":");
    const previous = lastSavedObservationRef.current;
    if (previous && previous.signature === signature && capturedAt - previous.capturedAt < 12000) {
      return;
    }

    lastSavedObservationRef.current = { signature, capturedAt };
    api.saveTeacherObservation(session.id, observation)
      .then((result) => {
        appendEvents([
          result.observationEvent,
          ...(result.suggestionEvent ? [result.suggestionEvent] : [])
        ]);
        setObservationError("");
      })
      .catch((error) => {
        lastSavedObservationRef.current = undefined;
        setObservationError(error instanceof Error ? error.message : "保存教师观察失败。");
      });
  }, [appendEvents, session.id, session.status, vision.latest]);

  const timeline = useMemo(
    () => events.filter((event) => event.type !== "classroom_metric").slice(-8).reverse(),
    [events]
  );
  const latestSuggestion = [...events].reverse().find((event) => event.type === "system_suggestion")?.content
    ?? (trainingTarget ? `本次复训目标：${trainingTarget.action}` : undefined)
    ?? "开始试讲后，系统会根据教师发言和 AI 学生反应生成即时策略建议。";

  const studentSnapshots = useMemo(() => {
    const runtimeByStudent = new Map(runtimeStates.map((state) => [state.studentId, state]));
    return selectedStudents.map((student, index) => {
      const lastEvent = [...events]
        .reverse()
        .find((event) => event.metadata?.studentId === student.id);
      const runtime = runtimeByStudent.get(student.id);
      const pose = runtime?.pose ?? inferStudentPose(student, lastEvent);
      const lastLine = lastEvent?.content ?? student.behaviorStyle;
      return {
        student,
        runtime,
        index,
        lastEvent,
        pose,
        statusText: runtime?.statusText ?? studentMoodLabel(pose),
        lastLine
      };
    });
  }, [events, runtimeStates, selectedStudents]);

  const activeCount = studentSnapshots.filter(({ pose }) => pose !== "distracted").length;
  const questionCount = events.filter((event) => event.type === "student_question").length;
  const distractedCount = studentSnapshots.filter(({ pose }) => pose === "distracted").length;

  const radarData = [
    { metric: "节奏", value: metrics.pace },
    { metric: "清晰", value: metrics.clarity },
    { metric: "提问", value: metrics.questioning },
    { metric: "参与", value: metrics.engagement },
    { metric: "互动", value: metrics.interaction }
  ];

  async function startSession() {
    const updated = await api.startSession(session.id);
    onSessionChange(updated);
  }

  async function sendTurn(inputMode: "manual" | "speech" = "manual") {
    if (!teacherText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.sendTurn(session.id, teacherText.trim(), inputMode);
      appendEvents([result.teacherEvent, ...result.stateEvents, ...result.responses, result.metricEvent]);
      setRuntimeStates(result.runtimeStates);
      setMetrics(result.metrics);
      setTeacherText("");
      setModelNotice(result.usedModel ? "本轮由大模型生成" : `本轮本地模拟：${result.fallbackReason || "未启用真实模型"}`);
    } finally {
      setSubmitting(false);
    }
  }

  function handleTeacherInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!shouldSendTeacherTurnFromKey({
      key: event.key,
      shiftKey: event.shiftKey,
      isComposing: event.nativeEvent.isComposing
    })) {
      return;
    }

    event.preventDefault();
    void sendTurn("manual");
  }

  async function sendTranscriptTurn() {
    const segments = transcript.finalSegments;
    if (!segments.length || submitting) return;
    setSubmitting(true);
    transcript.setLastError("");
    try {
      const result = await api.saveTranscriptSegments(session.id, {
        segments,
        sendAsTurn: true
      });
      result.transcriptEvents.forEach((event) => {
        const transcriptId = String(event.metadata.transcriptId ?? "");
        if (transcriptId) savedTranscriptIdsRef.current.add(transcriptId);
      });
      appendEvents(result.transcriptEvents);
      if (result.turnResult) {
        appendEvents([
          result.turnResult.teacherEvent,
          ...result.turnResult.stateEvents,
          ...result.turnResult.responses,
          result.turnResult.metricEvent
        ]);
        setRuntimeStates(result.turnResult.runtimeStates);
        setMetrics(result.turnResult.metrics);
        setModelNotice(result.turnResult.usedModel ? "本轮由大模型生成" : `本轮本地模拟：${result.turnResult.fallbackReason || "未启用真实模型"}`);
      }
      transcript.flushFinalSegments();
    } catch (error) {
      transcript.setLastError(error instanceof Error ? error.message : "发送转写回合失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function completeSession() {
    const result = await api.completeSession(session.id);
    onSessionChange(result.session);
    if (result.trainingTarget) {
      onTrainingTargetChange?.(result.trainingTarget);
    }
    onReport(result.report);
  }

  return (
    <main className="training-room">
      <section className="training-header training-header--wide">
        <div>
          <span className="eyebrow">Teacher Session Area</span>
          <h1>{session.courseTitle}</h1>
          <p>{session.topic} · {session.status === "active" ? "实训进行中" : session.status === "completed" ? "已完成" : "待开始"}</p>
          {trainingTarget ? (
            <div className="training-target-banner">
              <span>{trainingTarget.status === "completed" ? "复训已完成" : "复训目标"}</span>
              <strong>{trainingTarget.recommendationTitle}</strong>
              <small>{trainingTarget.recommendationDetail}</small>
            </div>
          ) : null}
        </div>
        <div className="header-controls">
          <span className="status-pill">
            <CircleDot size={15} />
            {activeCount} 位在场
          </span>
          <span className="status-pill">
            <CircleDot size={15} />
            {questionCount} 次提问
          </span>
          <span className="status-pill">
            <CircleDot size={15} />
            {distractedCount} 位走神
          </span>
          {session.status === "draft" ? (
            <button className="primary-button" type="button" onClick={startSession}>
              <Play size={18} />
              开始试讲
            </button>
          ) : null}
          {session.status !== "completed" ? (
            <button className="danger-button" type="button" onClick={completeSession}>
              <Square size={17} />
              结束并生成报告
            </button>
          ) : (
            <span className="status-pill status-pill--done"><CheckCircle2 size={16} /> 报告已生成</span>
          )}
        </div>
      </section>

      <section className="training-grid">
        <div className="teacher-column">
          <div className="screen-card camera-card">
            <div className="screen-card__title">
              <span><Camera size={16} /> 教师摄像头</span>
              <button className="icon-only" type="button" onClick={() => setCameraEnabled((value) => !value)} title="开启或关闭摄像头">
                {cameraEnabled ? <VideoOff size={18} /> : <Camera size={18} />}
              </button>
            </div>
            {cameraEnabled && cameraStatus === "active" ? (
              <video ref={videoRef} autoPlay playsInline muted />
            ) : (
              <div className="camera-placeholder">
                <Camera size={44} />
                <strong>{cameraStatus === "blocked" ? "摄像头权限未开启" : "摄像头预览区"}</strong>
                <span>权限不可用时仍可通过手动输入完成试讲演示。</span>
              </div>
            )}
          </div>

          <TeacherObservationPanel
            status={vision.status}
            observation={vision.latest?.payload}
            recording={cameraEnabled && cameraStatus === "active"}
            error={vision.error || observationError}
          />

          <div className="screen-card lesson-card">
            <div className="screen-card__title">
              <span><CircleDot size={16} /> 试讲课件</span>
              <span className="live-pill">Live</span>
            </div>
            <div className="lesson-slide">
              <span>{session.courseTitle}</span>
              <h2>{session.topic}</h2>
              <p>目标：用短讲解、短提问和即时反馈完成一个课堂片段。</p>
            </div>
          </div>

          <div className="teacher-input">
            <textarea
              value={teacherText}
              onChange={(event) => setTeacherText(event.target.value)}
              onKeyDown={handleTeacherInputKeyDown}
              placeholder="输入教师发言，例如：同学们，谁能说说直角三角形里最长的边是哪一条？"
            />
            <div className="input-controls">
              <button className="primary-button" type="button" onClick={() => sendTurn("manual")} disabled={submitting}>
                {submitting ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                发送课堂回合
              </button>
            </div>
            <div className="transcript-panel">
              <div className="screen-card__title">
                <span><Mic size={15} /> 语音转写</span>
                <span className={`speech-status-pill speech-status-pill--${speech.status}`}>{speechStatusLabel(speech.status)}</span>
              </div>
              <div className="transcript-panel__live">
                <strong>实时</strong>
                <span>{transcript.interimText || "开启后会显示尚未定稿的实时识别文本。"}</span>
              </div>
              <div className="transcript-segment-list">
                {transcript.finalSegments.slice(-3).map((segment) => (
                  <span key={segment.id}>{segment.text}</span>
                ))}
                {!transcript.finalSegments.length ? <span>暂无最终转写片段。</span> : null}
              </div>
              {(speech.error || transcript.lastError) ? <p className="transcript-error">{speech.error || transcript.lastError}</p> : null}
              <div className="transcript-actions">
                <button
                  className="ghost-button"
                  type="button"
                  disabled={!speech.supported}
                  onClick={() => {
                    if (speech.listening) {
                      speech.stop();
                    } else {
                      speech.start();
                    }
                  }}
                >
                  {speech.listening ? <MicOff size={17} /> : <Mic size={17} />}
                  {speech.listening ? "停止连续转写" : "开始连续转写"}
                </button>
                <button className="ghost-button" type="button" onClick={transcript.clearTranscript}>
                  <Eraser size={17} />
                  清空转写
                </button>
                <button className="primary-button" type="button" onClick={sendTranscriptTurn} disabled={submitting || !transcript.finalSegments.length}>
                  {submitting ? <Loader2 className="spin" size={17} /> : <Send size={17} />}
                  用转写发送回合
                </button>
              </div>
            </div>
          </div>

          <div className="teacher-feedback-stack">
            <div className="suggestion-panel screen-card">
              <div className="screen-card__title">
                <span>即时教学建议</span>
              </div>
              {trainingTarget ? (
                <div className="training-target-focus">
                  <strong>{trainingTarget.status === "completed" ? "复训结果已归档" : "本次复训"}</strong>
                  <span>{trainingTarget.action}</span>
                </div>
              ) : null}
              <p>{latestSuggestion}</p>
            </div>

            <div className="pulse-panel screen-card">
              <div className="screen-card__title">
                <span>课堂脉搏</span>
              </div>
              <div className="pulse-rings">
                <div className={`pulse-ring ${metricColor(metrics.attention)}`}>
                  <strong>{metrics.attention}%</strong>
                  <span>注意力</span>
                </div>
                <div className={`pulse-ring ${metricColor(metrics.confusion, true)}`}>
                  <strong>{metrics.confusion}%</strong>
                  <span>困惑度</span>
                </div>
                <div className={`pulse-ring ${metricColor(metrics.interaction)}`}>
                  <strong>{metrics.interaction}%</strong>
                  <span>互动度</span>
                </div>
              </div>
            </div>

            <div className="radar-panel screen-card">
              <div className="screen-card__title">
                <span>教师表现雷达</span>
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#284257" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: "#9fb7c8", fontSize: 12 }} />
                  <Radar dataKey="value" stroke="#4bd8c8" fill="#4bd8c8" fillOpacity={0.35} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <section className="student-stage screen-card">
          <div className="screen-card__title">
            <span>AI学生互动舞台</span>
            <span className="model-notice">{modelNotice}</span>
          </div>
          <div className="student-stage__summary">
            <span>在场 {activeCount}</span>
            <span>提问 {questionCount}</span>
            <span>走神 {distractedCount}</span>
          </div>
          <div className="student-stage__grid student-stage__deck">
            {studentSnapshots.map(({ student, runtime, index, lastEvent, pose, statusText, lastLine }) => (
              <article className="student-agent-card student-agent-card--portrait" key={student.id}>
                <div className="student-agent-card__figure">
                  <div className={`student-dialogue student-status-bubble student-status-bubble--${pose}`}>
                    <span className="student-live-status">{studentMoodLabel(pose)}</span>
                    <strong>{statusText}</strong>
                  </div>
                  <StudentPortrait
                    name={student.name}
                    pose={pose}
                    paletteIndex={index}
                    label={studentMoodLabel(pose)}
                  />
                </div>
                <div className="student-agent-card__body">
                  <div className="student-agent-card__head">
                    <div>
                      <strong>{student.name}</strong>
                      <span>{student.avatar}</span>
                    </div>
                    <span className="mini-live">Live</span>
                  </div>
                  <div className="agent-bars student-agent-card__metrics">
                    <label>注意力 <meter value={runtime?.attention ?? student.attention} max={100} /></label>
                    <label>理解度 <meter value={runtime?.comprehension ?? student.comprehension} max={100} /></label>
                    <label>参与度 <meter value={runtime?.participation ?? student.participation} max={100} /></label>
                  </div>
                  <p className="student-agent-card__last-line">{lastLine}</p>
                  <small className="student-agent-card__memory">
                    {runtime?.memory.length ? `课堂记忆：${runtime.memory[runtime.memory.length - 1]}` : lastEvent ? `最近状态：${lastEvent.type}` : student.strategy}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="insight-rail timeline-panel timeline-panel--wide screen-card">
          <div className="screen-card__title">
            <span>课堂时间线</span>
          </div>
          {timeline.length ? (
            <div className="timeline-table__content">
              <table className="timeline-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>类型</th>
                    <th>角色</th>
                    <th>内容</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((event) => (
                    <tr key={event.id}>
                      <td>{new Date(event.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>{eventTypeLabel(event.type)}</td>
                      <td>{event.actor}</td>
                      <td>{event.content}</td>
                      <td><span className="timeline-status">{timelineStatus(event)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">暂无课堂事件，发送第一句教师发言后开始记录。</div>
          )}
        </section>
      </section>

    </main>
  );
}
