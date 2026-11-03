import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Audience } from "../scripts/events";
import { api, AppState, AUDIENCE_LABELS, EpisodeDetail, followJob } from "./api";
import { currentStep, Feed, Rundown, TimedEvent } from "./Progress";
import { Phone, Transcript, useTimeline } from "./Result";

type RenderState = { done: number; total: number } | "done" | null;

const todayLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date());

export const App = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [cityId, setCityId] = useState("");
  const [audience, setAudience] = useState<Audience>("general");
  const [reuseFacts, setReuseFacts] = useState(true);
  const [events, setEvents] = useState<TimedEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [tab, setTab] = useState<"log" | "script">("script");
  const [rendering, setRendering] = useState<RenderState>(null);
  const playerRef = useRef<PlayerRef>(null);
  const timeline = useTimeline(episodeId);

  const refresh = useCallback(() => api.state().then((s) => (setState(s), s)), []);
  useEffect(() => {
    refresh().then((s) => setCityId((id) => id || s.cities[0]?.id || ""));
  }, [refresh]);

  const city = state?.cities.find((c) => c.id === cityId);
  const existing = state?.episodes
    .filter((e) => e.cityId === cityId && e.audience === audience)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .at(-1);
  const cityHasRun = !!state?.episodes.some((e) => e.cityId === cityId);

  // Picking a city and audience shows the latest finished episode for them.
  useEffect(() => {
    if (busy) return;
    setEpisodeId(existing?.voiced ? existing.id : null);
    setRendering(existing?.mp4 ? "done" : null);
  }, [busy, existing?.id, existing?.voiced, existing?.mp4]);

  useEffect(() => {
    setDetail(null);
    if (episodeId) api.episode(episodeId).then(setDetail);
  }, [episodeId]);

  const startJob = async (start: () => Promise<{ jobId: string }>) => {
    setBusy(true);
    setEvents([]);
    setTab("log");
    setEpisodeId(null);
    try {
      const { jobId } = await start();
      followJob(jobId, (e) => {
        setEvents((prev) => [...prev, { ...e, at: Date.now() }]);
        if (e.type === "done") {
          refresh().then(() => {
            setBusy(false);
            setEpisodeId(e.episodeId);
            setTab("script");
          });
        }
        if (e.type === "error") setBusy(false);
      });
    } catch (err) {
      setEvents([{ type: "error", message: (err as Error).message, at: Date.now() }]);
      setBusy(false);
    }
  };

  const make = () => startJob(() => api.make(cityId, audience, cityHasRun && reuseFacts));
  const voiceOnly = () => existing && startJob(() => api.voice(existing.id));

  const exportMp4 = async () => {
    if (!episodeId) return;
    setRendering({ done: 0, total: 1 });
    const { jobId } = await api.render(episodeId);
    followJob(jobId, (e) => {
      if (e.type === "rendered") setRendering({ done: e.done, total: e.total });
      if (e.type === "done") refresh().then(() => setRendering("done"));
      if (e.type === "error") setRendering(null);
    });
  };

  const canMake = !!state?.hasApiKey && !!cityId && !busy;
  const needsVoice = !state?.hasApiKey && existing && !existing.voiced;
  const lamp = busy ? "rec" : episodeId ? "lit" : "off";
  const step = currentStep(events);

  return (
    <div className="app">
      <header className="masthead">
        <div className="title-block">
          <h1>まちのAI放送局</h1>
          <p>役場の資料を、だれでも見られる3分のニュースに。</p>
        </div>
        <div className="mast-right">
          <span className="mast-meta">
            {todayLabel}
            {state && <> ／ {state.hasApiKey ? "Claude API 接続中" : "再生のみ（API キー未設定）"}</>}
          </span>
          <span className={`onair onair-${lamp}`}>{lamp === "rec" ? "制作中" : "ON AIR"}</span>
        </div>
      </header>

      <main className="desk">
        <section className="slip">
          <div className="slip-row">
            <label className="slip-field">
              <span className="slip-label">自治体</span>
              <select value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={busy}>
                {state?.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prefecture}　{c.city}
                  </option>
                ))}
              </select>
            </label>
            <div className="slip-field">
              <span className="slip-label">だれ向け</span>
              <div className="audience">
                {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => (
                  <button key={a} className={a === audience ? "on" : ""} onClick={() => setAudience(a)} disabled={busy}>
                    {AUDIENCE_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
            {needsVoice ? (
              <button className="go" onClick={voiceOnly} disabled={busy}>
                声を入れて再生
              </button>
            ) : (
              <button className="go" onClick={make} disabled={!canMake}>
                {busy ? "取材中…" : existing ? "もう一度つくる" : "取材をはじめる"}
              </button>
            )}
          </div>
          <div className="slip-foot">
            {city && (
              <span className="sources">
                資料：
                {city.docs.map((d) => (
                  <a key={d.id} href={d.page ?? d.url} target="_blank" rel="noreferrer">
                    {d.title}
                  </a>
                ))}
                <a className="dim" href={city.licenseUrl} target="_blank" rel="noreferrer">
                  {city.license}
                </a>
              </span>
            )}
            {state?.hasApiKey && cityHasRun && (
              <label className="check">
                <input type="checkbox" checked={reuseFacts} onChange={(e) => setReuseFacts(e.target.checked)} disabled={busy} />
                前回の取材メモを使う（台本だけ書き直す）
              </label>
            )}
          </div>
        </section>

        <section className="work">
          {events.length > 0 && <Rundown events={events} />}
          <div className="sheet">
            <div className="tabs">
              <button className={tab === "log" ? "on" : ""} onClick={() => setTab("log")} disabled={events.length === 0}>
                制作の記録
              </button>
              <button className={tab === "script" ? "on" : ""} onClick={() => setTab("script")} disabled={!timeline}>
                完成原稿と出典
              </button>
            </div>
            <div className="sheet-body">
              {tab === "log" && events.length > 0 && <Feed events={events} />}
              {tab === "script" && timeline && <Transcript timeline={timeline} detail={detail} city={city} playerRef={playerRef} />}
              {events.length === 0 && !timeline && (
                <div className="howto">
                  <h2>この放送局のしくみ</h2>
                  <ol>
                    <li>自治体と、見る人を選んで「取材をはじめる」を押します。</li>
                    <li>Claude のデスク・記者・構成作家・校閲が、町の公開資料からニュースを一本つくります。</li>
                    <li>できた動画のセリフは、どれも元資料のページにつながっています。</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <aside className="monitor">
        <div className="monitor-label">
          <span>完成映像</span>
          {timeline && <span className="dim">{Math.round(timeline.total / 30)}秒</span>}
        </div>
        <div className="phone">
          {episodeId && timeline ? (
            <Phone episodeId={episodeId} timeline={timeline} playerRef={playerRef} />
          ) : (
            <div className="phone-empty">
              {busy ? (
                <>
                  <p className="phone-step">{step?.label ?? "準備中"}</p>
                  <p className="dim">{step?.role}</p>
                </>
              ) : (
                <p className="dim">{existing ? "まだ声が入っていません" : "この組み合わせの放送はまだありません"}</p>
              )}
            </div>
          )}
        </div>
        {episodeId && timeline && (
          <div className="export">
            {rendering === "done" ? (
              <a className="button" href={`/out/${episodeId}.mp4`} download>
                MP4 をダウンロード
              </a>
            ) : rendering ? (
              <div className="progress">
                <div className="progress-fill" style={{ width: `${(rendering.done / rendering.total) * 100}%` }} />
                <span>書き出し中 {Math.round((rendering.done / rendering.total) * 100)}%</span>
              </div>
            ) : (
              <button className="button" onClick={exportMp4}>
                MP4 に書き出す
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
