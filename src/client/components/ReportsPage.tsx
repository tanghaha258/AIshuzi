import { BarChart3, FileText } from "lucide-react";
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

export function ReportsPage({ reports, sessions }: ReportsPageProps) {
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
        {!reports.length ? <div className="empty-state">暂无报告。完成一次试讲后，这里会显示自动生成的课堂诊断。</div> : null}
        <div className="reports-grid">
          {reports.map((report) => {
            const session = sessions.find((item) => item.id === report.sessionId);
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
                  <BarChart3 size={22} />
                </div>
                <p>{report.summary}</p>
                <div className="report-chart">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dce7ed" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#167d78" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
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
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
