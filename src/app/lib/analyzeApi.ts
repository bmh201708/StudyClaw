import { apiUrl } from "./sessionApi";

export type AnalyzeAttachment = {
  originalName: string;
  mimeType: string;
  size: number;
  extractedText: string;
  imageHint?: string;
  extractError?: string;
};

export type AnalyzeResponse = {
  goal: string;
  contextForAI: string;
  attachments: AnalyzeAttachment[];
  limits: { maxFileBytes: number; maxFiles: number };
  ai: { status: string; message: string };
};

/** 将目标文字与附件一并提交后端，合并抽取文本供后续 AI（当前后端为占位说明） */
export async function analyzeSetupContext(goal: string, files: File[]): Promise<AnalyzeResponse | null> {
  try {
    const fd = new FormData();
    fd.append("goal", goal);
    for (const f of files) {
      fd.append("attachments", f);
    }
    const res = await fetch(apiUrl("/api/analyze"), {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      console.warn("[analyze]", res.status, err.error);
      return null;
    }
    return (await res.json()) as AnalyzeResponse;
  } catch (e) {
    console.warn("[analyze] network error", e);
    return null;
  }
}
