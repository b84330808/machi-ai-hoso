import { useEffect, useRef, type FC, type ReactNode } from "react";
import type { Fact, Issue, JobEvent, StepId, Story } from "../scripts/events";

export type TimedEvent = JobEvent & { at: number };

/** Each step of the pipeline is a member of a small newsroom. */
const STEPS: { id: StepId; label: string; role: string; working: string }[] = [
  { id: "fetch", label: "資料あつめ", role: "資料係", working: "町の公開資料を取り寄せています" },
  { id: "desk", label: "ネタ選び", role: "デスク", working: "資料を読み、暮らしへの影響が大きい順にネタを並べています" },
  { id: "facts", label: "裏取り", role: "記者", working: "原文のページを確かめながら、事実を一つずつ書き出しています" },
  { id: "writer", label: "台本", role: "構成作家", working: "確かめた事実だけで台本を書いています" },
  { id: "check", label: "校閲", role: "校閲", working: "数字を原文と照らし合わせ、言い回しを確認しています" },
  { id: "revise", label: "書き直し", role: "構成作家", working: "赤字を直して、もう一度校閲に回しています" },
  { id: "voice", label: "声入れ", role: "ナレーター", working: "ナレーションを収録しています" },
];

type StepState = "pending" | "active" | "done" | "skipped" | "failed";

const stepStates = (events: TimedEvent[]) => {
  const states = new Map<StepId, { state: StepState; start?: number; end?: number; detail?: string }>();
  for (const e of events) {
    if (e.type !== "step") continue;
    const prev = states.get(e.step);
    if (e.state === "start") states.set(e.step, { state: "active", start: e.at });
    else states.set(e.step, { state: e.state, start: prev?.start ?? e.at, end: e.at, detail: e.detail });
  }
  if (events.some((e) => e.type === "error")) {
    for (const [id, s] of states) if (s.state === "active") states.set(id, { ...s, state: "failed" });
  }
  return states;
};

const seconds = (ms: number) => `${Math.max(1, Math.round(ms / 1000))}秒`;

const STATE_MARK: Record<StepState, string> = { pending: "", active: "進行中", done: "済", skipped: "省略", failed: "中断" };

/** The rundown sheet: who is working on what, and how long each step took. */
export const Rundown: FC<{ events: TimedEvent[] }> = ({ events }) => {
  const states = stepStates(events);
  return (
    <table className="rundown">
      <thead>
        <tr>
          <th>項目</th>
          <th>担当</th>
          <th>状態</th>
        </tr>
      </thead>
      <tbody>
        {STEPS.map((step) => {
          const s = states.get(step.id) ?? { state: "pending" as StepState };
          return (
            <tr key={step.id} className={`rd-${s.state}`}>
              <td>{step.label}</td>
              <td className="rd-role">{step.role}</td>
              <td className="rd-state">{s.state === "done" && s.start && s.end ? seconds(s.end - s.start) : STATE_MARK[s.state]}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

/** Half-width characters to full-width, so every character fills one square of the manuscript paper. */
const fullWidth = (s: string) => s.replace(/[!-~]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).replace(/ /g, "　");

const SPEAKER = { anchor: "マチコ", kid: "ソウタ" } as const;

const Manuscript: FC<{ lines: { speaker: "anchor" | "kid"; text: string }[] }> = ({ lines }) => (
  <div className="genko">
    {lines.map((l, i) => (
      <div key={i} className="genko-line">
        <span className={`genko-speaker speaker-${l.speaker}`}>{SPEAKER[l.speaker]}</span>
        <span className="genko-text">{fullWidth(l.text)}</span>
      </div>
    ))}
  </div>
);

const STATUS_LABEL: Record<Story["status"], string> = { decided: "決定", proposal: "案", info: "お知らせ" };

const StoryList: FC<{ stories: Story[]; chosen: number; reused: boolean }> = ({ stories, chosen, reused }) => (
  <ol className="neta">
    {reused && <p className="note">前回の取材で選んだネタを使います。</p>}
    {stories.map((s, i) => (
      <li key={i} className={`neta-item ${i === chosen ? "chosen" : ""}`} style={{ animationDelay: `${i * 140}ms` }}>
        <span className="neta-impact" aria-label={`影響度 ${s.impact}/5`}>
          {"●".repeat(s.impact)}
          <span className="dim">{"○".repeat(5 - s.impact)}</span>
        </span>
        <div className="neta-body">
          <div className="neta-title">
            <span className="tag">{STATUS_LABEL[s.status]}</span>
            {s.headline}
          </div>
          <div className="neta-sub">
            {s.who}｜{s.change}
          </div>
        </div>
        {i === chosen && <span className="hanko small">採用</span>}
      </li>
    ))}
  </ol>
);

const FactList: FC<{ facts: Fact[] }> = ({ facts }) => (
  <div className="memos">
    {facts.map((f, i) => (
      <div key={f.id} className="memo" style={{ animationDelay: `${i * 100}ms` }}>
        <span className="memo-tab">{f.ref.match(/p\.\d+$/)?.[0]}</span>
        <div className="memo-text">{f.text}</div>
        <div className="memo-quote">原文「{f.quote}」</div>
      </div>
    ))}
  </div>
);

const ISSUE_BY: Record<Issue["by"], string> = { numbers: "数字", reviewer: "校閲" };

const Corrections: FC<{ issues: Issue[]; round: number }> = ({ issues, round }) =>
  issues.length === 0 ? (
    <div className="passed">
      <span className="hanko">校閲済</span>
      <span>{round === 1 ? "赤字なし" : "書き直しで赤字はすべて解消"}</span>
    </div>
  ) : (
    <ul className="redpen">
      {issues.map((issue, i) => (
        <li key={i} style={{ animationDelay: `${i * 160}ms` }}>
          <span className="redpen-tag">{ISSUE_BY[issue.by]}</span>
          {issue.text}
        </li>
      ))}
      {round === 2 && <p className="note">残った赤字は記録に残して公開します。</p>}
    </ul>
  );

const Meter: FC<{ done: number; total: number }> = ({ done, total }) => (
  <div className="meter">
    {Array.from({ length: total }, (_, i) => (
      <i key={i} className={i < done ? "on" : ""} />
    ))}
    <span>
      収録 {done}/{total}
    </span>
  </div>
);

/** Everything the newsroom produced, step by step, in the order it happened. */
export const Feed: FC<{ events: TimedEvent[] }> = ({ events }) => {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [events.length]);

  const states = stepStates(events);
  const of = <T extends JobEvent["type"]>(type: T) => events.filter((e): e is Extract<TimedEvent, { type: T }> => e.type === type);
  const error = of("error")[0];
  const voiced = of("voiced").at(-1);

  const body: Partial<Record<StepId, ReactNode>> = {
    fetch: (
      <ul className="docs">
        {of("doc").map((d, i) => (
          <li key={i}>
            <span className="doc-tag">PDF</span>
            {d.title}
            <span className="dim">
              {d.kb.toLocaleString()}KB{d.cached ? "・取得済み" : ""}
            </span>
          </li>
        ))}
      </ul>
    ),
    desk: of("stories").map((e, i) => <StoryList key={i} {...e} />),
    facts: of("facts").map((e, i) => <FactList key={i} facts={e.facts} />),
    writer: <Manuscript lines={of("line").filter((l) => l.round === 1)} />,
    check: of("issues")
      .filter((e) => e.round === 1)
      .map((e, i) => <Corrections key={i} {...e} />),
    revise: (
      <>
        <Manuscript lines={of("line").filter((l) => l.round === 2)} />
        {of("issues")
          .filter((e) => e.round === 2)
          .map((e, i) => (
            <Corrections key={i} {...e} />
          ))}
      </>
    ),
    voice: voiced && <Meter done={voiced.done} total={voiced.total} />,
  };

  return (
    <div className="feed">
      {STEPS.map((step) => {
        const s = states.get(step.id);
        if (!s) return null;
        return (
          <section key={step.id} className={`feed-step feed-${s.state}`}>
            <h3>
              <span className="feed-role">{step.role}</span>
              {step.label}
              {s.state === "skipped" && <span className="dim">（{s.detail ?? "省略"}）</span>}
            </h3>
            {s.state === "active" && (
              <p className="working">
                <span className="pen" />
                {step.working}
              </p>
            )}
            {body[step.id]}
          </section>
        );
      })}
      {error && <div className="error">止まりました：{error.message}</div>}
      <div ref={end} />
    </div>
  );
};

export const currentStep = (events: TimedEvent[]) => {
  const states = stepStates(events);
  return STEPS.find((s) => states.get(s.id)?.state === "active");
};
