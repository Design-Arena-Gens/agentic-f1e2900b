"use client";

import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type GuideStep = {
  id: string;
  description: string;
  command?: string;
  expectPattern?: string;
  nextOnMatch?: string;
  nextOnNoMatch?: string;
};

type Guide = {
  name: string;
  steps: GuideStep[];
};

type Incident = {
  id: string;
  title: string;
  description: string;
};

function parseWorkbookToGuide(file: File): Promise<Guide> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });
        const steps: GuideStep[] = rows.map((row, idx) => ({
          id: String(row["id"] ?? idx + 1),
          description: String(row["description"] ?? ""),
          command: String(row["command"] ?? "") || undefined,
          expectPattern: String(row["expectPattern"] ?? "") || undefined,
          nextOnMatch: String(row["nextOnMatch"] ?? "") || undefined,
          nextOnNoMatch: String(row["nextOnNoMatch"] ?? "") || undefined,
        }));
        resolve({ name: wb.SheetNames[0] ?? "Guide", steps });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function runExecutor(command: string): Promise<{ output: string }>{
  const res = await fetch("/api/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command }),
  });
  if (!res.ok) throw new Error("Executor error");
  return res.json();
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [incident, setIncident] = useState<Incident>({
    id: "INC-001",
    title: "New incident",
    description: "Paste incident description here",
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [verdict, setVerdict] = useState<string>("");

  const stepsById = useMemo(() => {
    const map = new Map<string, GuideStep>();
    guide?.steps.forEach((s) => map.set(s.id, s));
    return map;
  }, [guide]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const parsed = await parseWorkbookToGuide(file);
    setGuide(parsed);
  };

  const appendLog = (line: string) => setLogs((l) => [...l, line]);

  const runWorkflow = async () => {
    if (!guide || guide.steps.length === 0) return;
    setRunning(true);
    setLogs([]);
    setVerdict("");
    try {
      let currentId: string | undefined = guide.steps[0]?.id;
      let safetyCounter = 0;
      while (currentId && safetyCounter < 100) {
        safetyCounter += 1;
        const step = stepsById.get(currentId);
        if (!step) break;
        appendLog(`Step ${step.id}: ${step.description}`);
        let output = "";
        if (step.command) {
          const exec = await runExecutor(step.command);
          output = exec.output;
          appendLog(`$ ${step.command}`);
          appendLog(output);
        }
        if (step.expectPattern) {
          const re = new RegExp(step.expectPattern, "i");
          const matched = re.test(output);
          currentId = matched ? step.nextOnMatch : step.nextOnNoMatch;
          appendLog(
            `Decision: ${matched ? "match" : "no match"} -> next ${currentId ?? "END"}`
          );
        } else {
          currentId = step.nextOnMatch || undefined;
        }
      }
      setVerdict("Workflow complete. Review logs and finalize.");
    } catch (e: any) {
      appendLog(`Error: ${e.message ?? String(e)}`);
      setVerdict("Workflow aborted due to error.");
    } finally {
      setRunning(false);
    }
  };

  const updateIncident = async () => {
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident, verdict, logs }),
    });
    if (!res.ok) throw new Error("Failed to update incident");
    appendLog("Incident updated with verdict.");
  };

  const aiSummarize = async () => {
    const res = await fetch("/api/ai/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ incident, logs }),
    });
    if (!res.ok) {
      appendLog("AI summary failed (missing key?)");
      return;
    }
    const data = await res.json();
    setVerdict(data.verdict || "");
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold">Incident Auto-Triage Agent</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Upload an Excel guide, review steps, and run the workflow.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Incident</h2>
            <label className="mb-2 block text-sm">Title</label>
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
              value={incident.title}
              onChange={(e) => setIncident({ ...incident, title: e.target.value })}
            />
            <label className="mt-3 mb-2 block text-sm">Description</label>
            <textarea
              className="h-28 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
              value={incident.description}
              onChange={(e) =>
                setIncident({ ...incident, description: e.target.value })
              }
            />
            <div className="mt-4">
              <button
                className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={updateIncident}
                disabled={!verdict}
              >
                Update Incident with Verdict
              </button>
              <button
                className="ml-2 rounded-md bg-zinc-800 px-3 py-2 text-sm text-white"
                onClick={aiSummarize}
              >
                AI Summarize Logs
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Upload Guide (Excel)</h2>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={onUpload}
            />
            {guide && (
              <div className="mt-3 text-sm">
                <div className="font-medium">Guide: {guide.name}</div>
                <div className="text-zinc-600">{guide.steps.length} steps</div>
              </div>
            )}
            <div className="mt-4">
              <button
                className="rounded-md bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={runWorkflow}
                disabled={!guide || running}
              >
                {running ? "Running..." : "Run Workflow"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Steps</h2>
            <ol className="list-inside list-decimal space-y-2 text-sm">
              {guide?.steps.map((s) => (
                <li key={s.id}>
                  <div className="font-medium">{s.description}</div>
                  {s.command && (
                    <div className="text-zinc-600">$ {s.command}</div>
                  )}
                  {(s.expectPattern || s.nextOnMatch || s.nextOnNoMatch) && (
                    <div className="text-xs text-zinc-500">
                      expect: {s.expectPattern || "-"} | onMatch→{s.nextOnMatch || "-"} | onNoMatch→{s.nextOnNoMatch || "-"}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Logs</h2>
            <div className="h-64 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-2 text-xs font-mono">
              {logs.map((l, i) => (
                <div key={i}>{l}</div>
              ))}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-sm">Verdict / Suggestion</label>
              <textarea
                className="h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-800"
                value={verdict}
                onChange={(e) => setVerdict(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
