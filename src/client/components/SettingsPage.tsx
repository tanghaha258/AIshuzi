import { Database, Loader2, PlugZap, Save, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { DashboardData, ModelProviderConfig } from "../../shared/types";

interface SettingsPageProps {
  data: DashboardData;
}

export function SettingsPage({ data }: SettingsPageProps) {
  const [config, setConfig] = useState<ModelProviderConfig | null>(null);
  const [saved, setSaved] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  useEffect(() => {
    api.getModelProvider().then(setConfig).catch(() => undefined);
  }, []);

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
    } finally {
      setTesting(false);
    }
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
            <button className="primary-button" type="button" onClick={saveConfig}>
              <Save size={17} />
              保存配置
            </button>
            <button className="ghost-button" type="button" onClick={testConfig} disabled={testing}>
              {testing ? <Loader2 className="spin" size={17} /> : <Wifi size={17} />}
              测试连接
            </button>
            {saved ? <span className="save-notice">{saved}</span> : null}
            {testMessage ? <span className="save-notice">{testMessage}</span> : null}
          </>
        ) : (
          <div className="empty-state">正在读取模型配置...</div>
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
