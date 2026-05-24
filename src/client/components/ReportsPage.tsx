import { useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Clipboard, FileCode2, FileText, Search, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { EvaluationReport, TrainingSession } from "../../shared/types";

interface ReportsPageProps {
  reports: EvaluationReport[];
  sessions: TrainingSession[];
}

const reportPageSize = 1;

export function ReportsPage({ reports, sessions }: ReportsPageProps) {
  const [copiedKey, setCopiedKey] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

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
                  <span className={report.generatedBy === "model" ? "report-source-pill report-source-pill--model" : "report-source-pill"}>
                    {report.generatedBy === "model" ? <Sparkles size={15} /> : <FileText size={15} />}
                    {sourceLabel(report)}
                  </span>
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
                    {report.recommendations.map((item) => (
                      <div className={`report-recommendation-card report-recommendation-card--${item.priority}`} key={item.title}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>{priorityLabel(item.priority)}</span>
                        </div>
                        <p>{item.detail}</p>
                        <small>{item.action}</small>
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
                        {report.keyTimeline.map((item) => (
                          <tr key={`${item.evidenceEventId}-${item.time}`}>
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
                    {report.strengths.map((item) => <span key={item}>{item}</span>)}
                  </div>
                  <div>
                    <h3>改进</h3>
                    {report.improvements.map((item) => <span key={item}>{item}</span>)}
                  </div>
                </div>
                <div className="key-moments">
                  <h3>关键节点</h3>
                  {report.keyMoments.map((item) => <span key={item}>{item}</span>)}
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
