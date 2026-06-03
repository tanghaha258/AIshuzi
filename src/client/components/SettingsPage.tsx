import { BrainCircuit, Database, FileSearch, Loader2, PlugZap, RotateCcw, Save, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { DashboardData, ModelCallLog, ModelProviderConfig } from "../../shared/types";
import { createDeepSeekDefaultProvider, deepSeekRecommendedModels } from "../../shared/providerDefaults";

interface SettingsPageProps {
  data: DashboardData;
}

export function SettingsPage({ data }: SettingsPageProps) {
  const [config, setConfig] = useState<ModelProviderConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [testing, setTesting] = useState(false);
  const [scenarioTesting, setScenarioTesting] = useState<"student-turn" | "lesson-plan" | "report" | "">("");
  const [testMessage, setTestMessage] = useState("");
  const [scenarioMessage, setScenarioMessage] = useState("");
  const [modelCalls, setModelCalls] = useState<ModelCallLog[]>([]);

  useEffect(() => {
    api.getModelProvider().then(setConfig).catch(() => undefined);
    api.listModelCalls(12).then(setModelCalls).catch(() => undefined);
  }, []);

  async function refreshModelCalls() {
    try {
      setModelCalls(await api.listModelCalls(12));
    } catch {
      setModelCalls([]);
    }
  }

  async function saveConfig() {
    if (!config) return;
    const next = await api.saveModelProvider(config);
    setConfig(next);
    setSaved("模型配置已保存");
    window.setTimeout(() => setSaved(""), 1800);
  }

  async function testConfig() {
    if (!config) return;
    setTesting(true);
    setTestMessage("");
    try {
      const result = await api.testModelProvider(config);
      setTestMessage(result.message);
      await refreshModelCalls();
    } finally {
      setTesting(false);
    }
  }

  async function testScenario(scenario: "student-turn" | "lesson-plan" | "report") {
    if (!config) return;
    setScenarioTesting(scenario);
    setScenarioMessage("");
    try {
      const result = await api.testModelScenario(config, scenario);
      const sample = result.sample ? `\n${JSON.stringify(result.sample, null, 2)}` : "";
      setScenarioMessage(`${result.message}${sample}`);
      await refreshModelCalls();
    } finally {
      setScenarioTesting("");
    }
  }

  function modelCallLabel(scenario: ModelCallLog["scenario"]) {
    switch (scenario) {
      case "student-turn":
        return "AI学生";
      case "lesson-plan":
        return "备课";
      case "report":
        return "报告";
      default:
        return "连接测试";
    }
  }

  function modelCallStatusLabel(call: ModelCallLog) {
    if (call.status === "success" && call.usedModel) return "真实调用";
    if (call.status === "fallback") return "本地降级";
    return "调用失败";
  }

  function fillDeepSeekDefaults() {
    const defaults = createDeepSeekDefaultProvider();
    setConfig((current) => ({
      ...defaults,
      id: current?.id ?? defaults.id,
      apiKey: current?.apiKey ?? defaults.apiKey,
      enabled: current?.enabled ?? defaults.enabled,
      updatedAt: current?.updatedAt ?? defaults.updatedAt
    }));
    setSaved("已填入 DeepSeek 默认配置");
    window.setTimeout(() => setSaved(""), 1800);
  }

  return (
    <main className="page-stack">
      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Model Provider</span>
            <h1>大模型设置</h1>
          </div>
          <PlugZap size={26} />
        </div>
        {config ? (
          <>
            <div className="form-grid">
              <label>
                Provider 名称
                <input value={config.provider} onChange={(event) => setConfig({ ...config, provider: event.target.value })} />
              </label>
              <label>
                Base URL
                <input value={config.baseURL} onChange={(event) => setConfig({ ...config, baseURL: event.target.value })} />
              </label>
              <label>
                API Key
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
                  placeholder="sk-..."
                />
              </label>
              <label>
                模型名
                <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} />
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={config.temperature}
                  onChange={(event) => setConfig({ ...config, temperature: Number(event.target.value) })}
                />
              </label>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(event) => setConfig({ ...config, enabled: event.target.checked })}
                />
                启用真实大模型生成
              </label>
            </div>
            <p className="muted-text">
              DeepSeek 默认地址为 https://api.deepseek.com，推荐模型：{deepSeekRecommendedModels.join(" / ")}。
            </p>
            <div className="settings-actions">
              <button className="primary-button" type="button" onClick={saveConfig}>
                <Save size={17} />
                保存配置
              </button>
              <button className="ghost-button" type="button" onClick={testConfig} disabled={testing}>
                {testing ? <Loader2 className="spin" size={17} /> : <Wifi size={17} />}
                测试连接
              </button>
              <button className="ghost-button" type="button" onClick={fillDeepSeekDefaults}>
                <RotateCcw size={17} />
                DeepSeek 快填
              </button>
            </div>
            {saved ? <span className="save-notice">{saved}</span> : null}
            {testMessage ? <span className="save-notice">{testMessage}</span> : null}
            <div className="model-scenario-tests">
              <button className="ghost-button" type="button" onClick={() => testScenario("student-turn")} disabled={Boolean(scenarioTesting)}>
                {scenarioTesting === "student-turn" ? <Loader2 className="spin" size={17} /> : <BrainCircuit size={17} />}
                AI学生回应测试
              </button>
              <button className="ghost-button" type="button" onClick={() => testScenario("lesson-plan")} disabled={Boolean(scenarioTesting)}>
                {scenarioTesting === "lesson-plan" ? <Loader2 className="spin" size={17} /> : <PlugZap size={17} />}
                备课生成测试
              </button>
              <button className="ghost-button" type="button" onClick={() => testScenario("report")} disabled={Boolean(scenarioTesting)}>
                {scenarioTesting === "report" ? <Loader2 className="spin" size={17} /> : <FileSearch size={17} />}
                报告生成测试
              </button>
            </div>
            {scenarioMessage ? <pre className="model-test-output">{scenarioMessage}</pre> : null}
          </>
        ) : (
          <div className="empty-state">正在读取模型配置...</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Model Calls</span>
            <h2>最近模型调用</h2>
          </div>
          <Wifi size={24} />
        </div>
        {modelCalls.length ? (
          <div className="model-call-log-list">
            {modelCalls.map((call) => (
              <article className="model-call-log" key={call.id}>
                <div>
                  <strong>{modelCallLabel(call.scenario)}</strong>
                  <span>{call.provider} / {call.model || "未指定模型"}</span>
                </div>
                <span className={`model-call-status model-call-status--${call.status}`}>
                  {modelCallStatusLabel(call)}
                </span>
                <small>{call.durationMs}ms · {new Date(call.createdAt).toLocaleString("zh-CN")}</small>
                {call.fallbackReason ? <p>{call.fallbackReason}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="model-call-empty">暂无模型调用记录。保存配置后可先运行连接测试或场景测试。</div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Local Data</span>
            <h2>本地数据概览</h2>
          </div>
          <Database size={24} />
        </div>
        <div className="data-overview">
          <span>课程：{data.courses.length}</span>
          <span>AI学生：{data.students.length}</span>
          <span>实训：{data.sessions.length}</span>
          <span>报告：{data.reports.length}</span>
        </div>
        <p className="muted-text">当前版本使用本机 SQLite 保存数据，不上传课堂内容。数据库文件位于项目的 data 目录。</p>
      </section>
    </main>
  );
}
