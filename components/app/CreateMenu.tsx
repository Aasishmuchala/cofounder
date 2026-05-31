"use client";

import * as React from "react";
import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { DEPARTMENTS, departmentColor } from "@/lib/agent-types";

type Mode = "menu" | "task" | "agent" | null;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.08em] text-[var(--text-50)]">{label}</span>
      {children}
    </label>
  );
}

function DeptSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[9px] border border-black/10 bg-white px-3 py-2 font-display text-[14px] text-[var(--text)] outline-none focus:border-[var(--text-30)]"
    >
      {DEPARTMENTS.map((d) => (
        <option key={d} value={d}>{d}</option>
      ))}
    </select>
  );
}

export default function CreateMenu({
  addTask,
  addAgent,
  onCreatedTask,
  onCreatedAgent,
}: {
  addTask: (title: string, department: string, detail?: string) => void | Promise<void>;
  addAgent: (name: string, department: string, blurb: string) => void;
  onCreatedTask?: () => void;
  onCreatedAgent?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(null);

  // task form
  const [tTitle, setTTitle] = useState("");
  const [tDept, setTDept] = useState<string>("Engineering");
  const [tDetail, setTDetail] = useState("");
  // agent form
  const [aName, setAName] = useState("");
  const [aDept, setADept] = useState<string>("Operations");
  const [aBlurb, setABlurb] = useState("");

  const close = () => setMode(null);

  const submitTask = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!tTitle.trim()) return;
    void addTask(tTitle, tDept, tDetail);
    setTTitle("");
    setTDetail("");
    close();
    onCreatedTask?.();
  };
  const submitAgent = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!aName.trim()) return;
    addAgent(aName, aDept, aBlurb);
    setAName("");
    setABlurb("");
    close();
    onCreatedAgent?.();
  };

  return (
    <>
      {/* FAB + popover menu (bottom-center) */}
      <div className="absolute bottom-5 left-1/2 z-30 -translate-x-1/2">
        {mode === "menu" && (
          <>
            <div className="fixed inset-0 z-0" onClick={close} aria-hidden />
            <div className="absolute bottom-14 left-1/2 z-10 w-[300px] -translate-x-1/2 overflow-hidden rounded-[14px] bg-[#2b2b2e] p-1 shadow-deep">
              <button onClick={() => setMode("agent")} className="flex w-full items-center gap-3 rounded-[11px] px-3 py-3 text-left transition-colors hover:bg-white/10">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6"><circle cx="12" cy="8" r="3.2" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" strokeLinecap="round" /></svg>
                </span>
                <span>
                  <span className="block font-display text-[15px] text-white">New Agent</span>
                  <span className="block text-[12px] text-white/55">Employee you can give tasks to</span>
                </span>
              </button>
              <button onClick={() => setMode("task")} className="flex w-full items-center gap-3 rounded-[11px] px-3 py-3 text-left transition-colors hover:bg-white/10">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] bg-white/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.6"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8 12h8M12 8v8" strokeLinecap="round" /></svg>
                </span>
                <span>
                  <span className="block font-display text-[15px] text-white">New Task</span>
                  <span className="block text-[12px] text-white/55">Work to assign your agents</span>
                </span>
              </button>
            </div>
          </>
        )}
        <button
          onClick={() => setMode((m) => (m === "menu" ? null : "menu"))}
          aria-label="Create new agent or task"
          className="grid h-11 w-11 place-items-center rounded-[12px] bg-[var(--text)] text-white shadow-deep transition-transform hover:scale-105"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cx("transition-transform", mode === "menu" && "rotate-45")}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Composer modal */}
      {(mode === "task" || mode === "agent") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={close} />
          <div className="relative w-[380px] max-w-full rounded-[16px] bg-[var(--background)] p-5 shadow-deep">
            {mode === "task" ? (
              <form onSubmit={submitTask} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: departmentColor(tDept) }} />
                  <h3 className="font-display text-[18px] text-[var(--text)]">New task</h3>
                </div>
                <Field label="What should the agent do?">
                  <input autoFocus value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Draft the launch email" className="w-full rounded-[9px] border border-black/10 bg-white px-3 py-2 font-display text-[14px] text-[var(--text)] outline-none focus:border-[var(--text-30)]" />
                </Field>
                <Field label="Department"><DeptSelect value={tDept} onChange={setTDept} /></Field>
                <Field label="Detail (optional)">
                  <textarea value={tDetail} onChange={(e) => setTDetail(e.target.value)} rows={2} placeholder="One line on what to deliver…" className="w-full resize-none rounded-[9px] border border-black/10 bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-30)]" />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={close} className="rounded-[9px] bg-[#efefec] px-4 py-2 font-display text-[13px] text-[var(--text-70)]">Cancel</button>
                  <button type="submit" disabled={!tTitle.trim()} className="rounded-[9px] px-4 py-2 font-display text-[13px] font-medium text-white shadow-glossy disabled:opacity-40" style={{ background: "var(--text)" }}>Create task</button>
                </div>
              </form>
            ) : (
              <form onSubmit={submitAgent} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: departmentColor(aDept) }} />
                  <h3 className="font-display text-[18px] text-[var(--text)]">New agent</h3>
                </div>
                <Field label="Agent name">
                  <input autoFocus value={aName} onChange={(e) => setAName(e.target.value)} placeholder="e.g. Growth Agent" className="w-full rounded-[9px] border border-black/10 bg-white px-3 py-2 font-display text-[14px] text-[var(--text)] outline-none focus:border-[var(--text-30)]" />
                </Field>
                <Field label="Department"><DeptSelect value={aDept} onChange={setADept} /></Field>
                <Field label="What does it do?">
                  <textarea value={aBlurb} onChange={(e) => setABlurb(e.target.value)} rows={2} placeholder="e.g. Runs paid acquisition experiments and reports ROAS." className="w-full resize-none rounded-[9px] border border-black/10 bg-white px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--text-30)]" />
                </Field>
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={close} className="rounded-[9px] bg-[#efefec] px-4 py-2 font-display text-[13px] text-[var(--text-70)]">Cancel</button>
                  <button type="submit" disabled={!aName.trim()} className="rounded-[9px] px-4 py-2 font-display text-[13px] font-medium text-white shadow-glossy disabled:opacity-40" style={{ background: "var(--text)" }}>Create agent</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
