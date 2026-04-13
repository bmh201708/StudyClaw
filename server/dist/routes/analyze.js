import { Router } from "express";
import multer from "multer";
import { generateStudyPlan } from "../ai/service.js";
import { extractFileText } from "../extractFileText.js";
export const analyzeRouter = Router();
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB per file
const MAX_FILES = 10;
const MAX_GOAL_CHARS = 50_000;
const MAX_CONTEXT_OUT = 400_000;
const ALLOWED_MIMES = new Set([
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
]);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
    fileFilter: (_req, file, cb) => {
        const ok = ALLOWED_MIMES.has(file.mimetype) ||
            /\.(txt|md|pdf|docx|doc|jpe?g|png|gif|webp)$/i.test(file.originalname);
        if (ok)
            cb(null, true);
        else
            cb(new Error(`unsupported file type: ${file.mimetype}`));
    },
});
analyzeRouter.post("/", upload.array("attachments", MAX_FILES), async (req, res) => {
    const files = req.files;
    const goalRaw = typeof req.body?.goal === "string" ? req.body.goal : "";
    const goal = goalRaw.slice(0, MAX_GOAL_CHARS);
    if (!goal.trim() && (!files || files.length === 0)) {
        res.status(400).json({ error: "请填写目标描述，或至少上传一个附件" });
        return;
    }
    const attachments = [];
    const sections = [];
    if (goal.trim()) {
        sections.push(`## 用户输入目标\n${goal.trim()}`);
    }
    if (files?.length) {
        for (const f of files) {
            const r = await extractFileText(f.buffer, f.mimetype, f.originalname);
            attachments.push({
                originalName: f.originalname,
                mimeType: f.mimetype,
                size: f.size,
                extractedText: r.extractedText.slice(0, 100_000),
                imageHint: r.imageHint,
                extractError: r.error,
            });
            const header = `## 附件: ${f.originalname} (${f.mimetype})`;
            if (r.imageHint) {
                sections.push(`${header}\n${r.imageHint}`);
            }
            else if (r.error) {
                sections.push(`${header}\n[抽取失败] ${r.error}`);
            }
            else if (r.extractedText.trim()) {
                sections.push(`${header}\n${r.extractedText.trim()}`);
            }
            else {
                sections.push(`${header}\n(无可抽取文本)`);
            }
        }
    }
    const contextForAI = sections.join("\n\n---\n\n").slice(0, MAX_CONTEXT_OUT);
    const aiPlan = await generateStudyPlan({
        goal: goal.trim() || "(来自附件)",
        contextForAI,
    });
    res.json({
        goal: goal.trim() || "(来自附件)",
        contextForAI,
        attachments,
        limits: {
            maxFileBytes: MAX_FILE_BYTES,
            maxFiles: MAX_FILES,
        },
        ai: aiPlan,
    });
});
// Multer / 业务错误
analyzeRouter.use((err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            res.status(413).json({ error: `单个文件超过 ${MAX_FILE_BYTES / 1024 / 1024} MiB 限制` });
            return;
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            res.status(413).json({ error: `最多上传 ${MAX_FILES} 个文件` });
            return;
        }
        res.status(400).json({ error: err.message });
        return;
    }
    if (err instanceof Error) {
        res.status(400).json({ error: err.message });
        return;
    }
    next(err);
});
