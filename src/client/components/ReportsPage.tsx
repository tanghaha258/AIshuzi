import { useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Clipboard, FileCode2, FileText, Search, Sparkles, Trash2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "../api";
import type { ClassroomEvent, EvaluationReport, ReportEvidenceContext, TrainingSession } from "../../shared/types";

interface ReportsPageProps {
  reports: EvaluationReport[];
  sessions: TrainingSession[];
  onDeleteReport: (reportId: string) => void;
  onCreateTrainingTarget: (reportId: string, recommendationTitle: string) => Promise<void>;
}

const reportPageSize = 1;

interface EvidenceContextState {
  expanded: boolean;
  loading: boolean;
  error: string;
  context?: ReportEvidenceContext;
}

export function ReportsPage({ reports, sessions, onDeleteReport, onCreateTrainingTarget }: ReportsPageProps) {
  const [copiedKey, setCopiedKey] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [evidenceContexts, setEvidenceContexts] = useState<Record<string, EvidenceContextState>>({});
  const [creatingTargetKey, setCreatingTargetKey] = useState("");

  async function copyExport(key: string, content: string) {
    if (!content) return;
    await navigator.clipboard?.writeText(content);
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey(""), 1800);
  }

  function sourceLabel(report: EvaluationReport) {
    if (report.generatedBy === "model") return "DeepSeek 诊断";
    return "本地规则诊断";
  }

  function priorityLabel(priority: EvaluationReport["recommendations"][number]["priority"]) {
    if (priority === "high") return "高优先级";
    if (priority === "medium") return "中优先级";
    return "低优先级";
  }

  function eventLabel(type: ClassroomEvent["type"]) {
    const labels: Record<ClassroomEvent["type"], string> = {
      teacher_utterance: "教师发言",
      transcript_segment: "语音转写",
      student_response: "学生回应",
      student_question: "学生提问",
      student_distraction: "走神信号",
      student_state_change: "状态变化",
      teacher_observation: "教师观察",
      system_suggestion: "教学建议",
      classroom_metric: "课堂指标",
      process_evaluation: "过程评价",
      report_evidence: "报告证据"
    };
    return labels[type];
  }

  function evidenceContextKey(reportId: string, evidenceId: string) {
    return `${reportId}:${evidenceId}`;
  }

  async function toggleEvidenceContext(reportId: string, evidenceId: string) {
    const key = evidenceContextKey(reportId, evidenceId);
    const current = evidenceContexts[key];
    if (current?.expanded) {
      setEvidenceContexts((items) => ({
        ...items,
        [key]: { ...items[key], expanded: false }
      }));
      return;
    }
    if (current?.context) {
      setEvidenceContexts((items) => ({
        ...items,
        [key]: { ...items[key], expanded: true }
      }));
      return;
    }

    setEvidenceContexts((items) => ({
      ...items,
      [key]: { expanded: true, loading: true, error: "" }
    }));

    try {
      const context = await api.getReportEvidenceContext(reportId, evidenceId, 2);
      setEvidenceContexts((items) => ({
        ...items,
        [key]: { expanded: true, loading: false, error: "", context }
      }));
    } catch (error) {
      setEvidenceContexts((items) => ({
        ...items,
        [key]: {
          expanded: true,
          loading: false,
          error: error instanceof Error ? error.message : "证据上下文加载失败"
        }
      }));
    }
  }

  function renderEvidenceContext(state?: EvidenceContextState) {
    if (!state?.expanded) return null;
    if (state.loading) return <div className="report-evidence-context">正在读取本地课堂事件...</div>;
    if (state.error) return <div className="report-evidence-context report-evidence-context--error">{state.error}</div>;
    if (!state.context) return null;

    return (
      <div className="report-evidence-context">
        {state.context.events.map((event) => (
          <div
            className={event.id === state.context?.target.id ? "report-context-event report-context-event--target" : "report-context-event"}
            key={event.id}
          >
            <span>{new Date(event.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</span>
            <strong>{eventLabel(event.type)} · {event.actor}</strong>
            <p>{event.content}</p>
          </div>
        ))}
      </div>
    );
  }

  function reportSearchText(report: EvaluationReport) {
    const session = sessions.find((item) => item.id === report.sessionId);
    return [
      session?.courseTitle,
      session?.topic,
      report.summary,
      report.generatedBy,
      report.evidence.map((item) => `${item.actor} ${item.quote}`).join(" "),
      report.recommendations.map((item) => `${item.title} ${item.detail}`).join(" ")
    ].join(" ").toLowerCase();
  }

  function confirmDeleteReport(report: EvaluationReport) {
    const session = sessions.find((item) => item.id === report.sessionId);
    const ok = window.confirm(`确定删除“${session?.courseTitle ?? "微格实训"} / ${session?.topic ?? "课堂诊断"}”这份课后报告吗？实训记录会保留。`);
    if (ok) onDeleteReport(report.id);
  }

  async function createRecommendationTarget(report: EvaluationReport, recommendationTitle: string) {
    const key = `${report.id}:${recommendationTitle}`;
    setCreatingTargetKey(key);
    try {
      await onCreateTrainingTarget(report.id, recommendationTitle);
    } finally {
      setCreatingTargetKey("");
    }
  }

  const filteredReports = reports.filter((report) => reportSearchText(report).includes(query.trim().toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / reportPageSize));
  const safePage = Math.min(page, totalPages);
  const visibleReports = filteredReports.slice((safePage - 1) * reportPageSize, safePage * reportPageSize);

  return (
    <main className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Evaluation</span>
            <h1>课后评价报告</h1>
          </div>
          <FileText size={26} />
        </div>
        {reports.length ? (
          <div className="report-list-toolbar list-toolbar">
            <label className="search-input">
              <Search size={16} />
              <input
                value={query}
                placeholder="搜索报告、课程、证据或建议"
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <div className="pagination-controls">
              <span>{filteredReports.length ? `第 ${safePage} / ${totalPages} 页，共 ${filteredReports.length} 份` : "无匹配报告"}</span>
              <button className="icon-only" type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} title="上一份报告">
                <ChevronLeft size={17} />
              </button>
              <button className="icon-only" type="button" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} title="下一份报告">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>
        ) : null}
        {!reports.length ? <div className="empty-state">暂无报告。完成一次试讲后，这里会显示自动生成的课堂诊断。</div> : null}
        {reports.length && !visibleReports.length ? <div className="empty-state">没有找到匹配报告。</div> : null}
        <div className="reports-grid">
          {visibleReports.map((report) => {
            const session = sessions.find((item) => item.id === report.sessionId);
            const evidenceByEventId = new Map(report.evidence.map((node) => [node.eventId, node]));
            const chartData = [
              { name: "注意", value: report.metrics.attention },
              { name: "互动", value: report.metrics.interaction },
              { name: "节奏", value: report.metrics.pace },
              { name: "清晰", value: report.metrics.clarity },
              { name: "提问", value: report.metrics.questioning },
              { name: "参与", value: report.metrics.engagement }
            ];
            return (
              <article className="report-card" key={report.id}>
                <div className="report-card__header">
                  <div>
                    <span className="eyebrow">{session?.courseTitle ?? "微格实训"}</span>
                    <h2>{session?.topic ?? "课堂诊断"}</h2>
                  </div>
                  <div className="report-card__actions">
                    <span className={report.generatedBy === "model" ? "report-source-pill report-source-pill--model" : "report-source-pill"}>
                      {report.generatedBy === "model" ? <Sparkles size={15} /> : <FileText size={15} />}
                      {sourceLabel(report)}
                    </span>
                    <button className="danger-button delete-report-button" type="button" onClick={() => confirmDeleteReport(report)}>
                      <Trash2 size={16} />
                      删除报告
                    </button>
                  </div>
                </div>
                {report.fallbackReason ? <div className="ai-generation-status">已切换本地诊断：{report.fallbackReason}</div> : null}
                <p>{report.summary}</p>
                <div className="report-overview-strip">
                  <span><strong>{report.overview.totalEvents}</strong>课堂事件</span>
                  <span><strong>{report.overview.teacherTurns}</strong>教师发言</span>
                  <span><strong>{report.overview.studentQuestions}</strong>学生提问</span>
                  <span><strong>{report.overview.systemSuggestions}</strong>即时建议</span>
                  <span><strong>{report.overview.durationMinutes > 0 ? report.overview.durationMinutes : "<1"}</strong>分钟</span>
                </div>

                {report.teacherObservation ? (
                  <div className="report-teacher-observation">
                    <div className="report-section-title">
                      <BarChart3 size={18} />
                      <h3>教师镜头观察</h3>
                    </div>
                    <p>{report.teacherObservation.summary}</p>
                    <div className="report-teacher-observation__metrics">
                      <span><strong>{report.teacherObservation.sampleCount}</strong>采样次数</span>
                      <span><strong>{report.teacherObservation.faceVisibleRate}%</strong>面部可见率</span>
                      <span><strong>{report.teacherObservation.averageConfidence}</strong>平均置信度</span>
                      <span><strong>{report.teacherObservation.frontFacingRate}%</strong>正对镜头率</span>
                      <span><strong>{report.teacherObservation.averageStability}</strong>平均稳定度</span>
                    </div>
                    <div className="report-teacher-observation__issues">
                      <strong>观察问题</strong>
                      <span>{report.teacherObservation.issueLabels.length ? report.teacherObservation.issueLabels.join("、") : "未发现明显问题"}</span>
                    </div>
                    <div className="report-teacher-observation__evidence">
                      <strong>关联证据</strong>
                      <span>{report.teacherObservation.evidenceEventIds.map((eventId) => evidenceByEventId.get(eventId)?.actor ?? eventId).join("、")}</span>
                    </div>
                  </div>
                ) : null}

                {report.processEvaluation ? (
                  <div className="report-process-evaluation">
                    <div className="report-section-title">
                      <Sparkles size={18} />
                      <h3>过程性评价与互评证据</h3>
                    </div>
                    <p>{report.processEvaluation.summary}</p>
                    <div className="report-process-evaluation__meta">
                      <span><strong>评价重点</strong>{report.processEvaluation.focus}</span>
                      <span><strong>评价方式</strong>{report.processEvaluation.method}</span>
                      <span><strong>互评提示</strong>{report.processEvaluation.peerReviewPrompt}</span>
                      <span><strong>证据类型</strong>{report.processEvaluation.evidenceTypes.join("、")}</span>
                    </div>
                    <div className="report-process-evaluation__stage-points">
                      {report.processEvaluation.stagePoints.map((item, index) => <span key={`${report.id}-stage-point-${index}`}>{item}</span>)}
                    </div>
                    <div className="report-process-evaluation__evidence">
                      <strong>关联证据：</strong>
                      {report.processEvaluation.evidenceEventIds.map((eventId) => evidenceByEventId.get(eventId)?.actor ?? eventId).join("、")}
                    </div>
                  </div>
                ) : null}

                <div className="report-detail-grid">
                  <div className="report-chart">
                    <div className="report-section-title">
                      <BarChart3 size={18} />
                      <h3>课堂表现雷达</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dce7ed" />
                        <XAxis dataKey="name" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#167d78" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="report-recommendation-list">
                    <div className="report-section-title">
                      <Sparkles size={18} />
                      <h3>证据绑定改进建议</h3>
                    </div>
                    {report.recommendations.map((item, index) => (
                      <div className={`report-recommendation-card report-recommendation-card--${item.priority}`} key={`${report.id}-recommendation-${index}`}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{priorityLabel(item.priority)}</span>
                        </div>
                        <p>{item.detail}</p>
                        <small>{item.action}</small>
                        <button
                          className="ghost-button training-target-button"
                          type="button"
                          disabled={creatingTargetKey === `${report.id}:${item.title}`}
                          onClick={() => createRecommendationTarget(report, item.title)}
                        >
                          {creatingTargetKey === `${report.id}:${item.title}` ? "正在生成复训..." : "用此建议复训"}
                        </button>
                        <em>
                          证据：
                          {item.evidenceEventIds.map((eventId) => evidenceByEventId.get(eventId)?.actor ?? eventId).join("、")}
                        </em>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="report-timeline-table">
                  <div className="report-section-title">
                    <FileText size={18} />
                    <h3>关键时间线</h3>
                  </div>
                  <div className="report-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>时间</th>
                          <th>节点</th>
                          <th>证据摘录</th>
                          <th>证据ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.keyTimeline.map((item, index) => (
                          <tr key={`${report.id}-timeline-${index}`}>
                            <td>{item.time}</td>
                            <td>{item.title}</td>
                            <td>{item.description}</td>
                            <td>{item.evidenceEventId}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="report-columns">
                  <div>
                    <h3>亮点</h3>
                    {report.strengths.map((item, index) => <span key={`${report.id}-strength-${index}`}>{item}</span>)}
                  </div>
                  <div>
                    <h3>改进</h3>
                    {report.improvements.map((item, index) => <span key={`${report.id}-improvement-${index}`}>{item}</span>)}
                  </div>
                </div>
                <div className="key-moments">
                  <h3>关键节点</h3>
                  {report.keyMoments.map((item, index) => <span key={`${report.id}-moment-${index}`}>{item}</span>)}
                </div>

                <div className="report-evidence-list">
                  <div className="report-section-title">
                    <FileCode2 size={18} />
                    <h3>证据链</h3>
                  </div>
                  {report.evidence.map((node) => (
                    <div className="report-evidence-node" key={node.id}>
                      <span>{node.actor}</span>
                      <strong>{node.quote}</strong>
                      <small>{node.reason}</small>
                      <button
                        className="ghost-button evidence-drilldown-button"
                        type="button"
                        onClick={() => toggleEvidenceContext(report.id, node.id)}
                      >
                        {evidenceContexts[evidenceContextKey(report.id, node.id)]?.expanded ? "收起上下文" : "展开上下文"}
                      </button>
                      {renderEvidenceContext(evidenceContexts[evidenceContextKey(report.id, node.id)])}
                    </div>
                  ))}
                </div>

                <div className="report-student-diagnosis">
                  <div className="report-section-title">
                    <Sparkles size={18} />
                    <h3>AI学生响应诊断</h3>
                  </div>
                  {report.studentResponses.map((item) => (
                    <div key={item.studentName}>
                      <strong>{item.studentName} · {item.profile}</strong>
                      <span>回应 {item.responseCount} 次，提问 {item.questionCount} 次，困惑 {item.confusionSignals} 次</span>
                      <p>{item.diagnosis}</p>
                    </div>
                  ))}
                </div>

                <div className="report-strategy-list">
                  <div className="report-section-title">
                    <BarChart3 size={18} />
                    <h3>教师策略命中</h3>
                  </div>
                  {report.teacherStrategyHits.map((item) => (
                    <div key={item.strategy}>
                      <strong>{item.strategy}</strong>
                      <span>{item.matched ? "已命中" : "待补充证据"}</span>
                      <p>{item.diagnosis}</p>
                    </div>
                  ))}
                </div>

                <div className="report-export-panel">
                  <div>
                    <strong>报告导出</strong>
                    <span>已生成 Markdown 与 HTML 内容，可用于归档或后续桌面端导出。</span>
                  </div>
                  <button className="ghost-button" type="button" onClick={() => copyExport(`${report.id}-markdown`, report.exportMarkdown)}>
                    <Clipboard size={17} />
                    {copiedKey === `${report.id}-markdown` ? "已复制" : "复制 Markdown"}
                  </button>
                  <button className="ghost-button" type="button" onClick={() => copyExport(`${report.id}-html`, report.exportHtml)}>
                    <FileCode2 size={17} />
                    {copiedKey === `${report.id}-html` ? "已复制" : "复制 HTML"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
