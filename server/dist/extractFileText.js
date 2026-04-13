import mammoth from "mammoth";
import pdfParse from "pdf-parse";
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
export async function extractFileText(buffer, mime, originalName) {
    const lower = originalName.toLowerCase();
    try {
        if (mime === "text/plain" || lower.endsWith(".txt") || lower.endsWith(".md")) {
            const text = buffer.toString("utf8");
            return { extractedText: text.slice(0, 500_000) };
        }
        if (mime === "application/pdf" || lower.endsWith(".pdf")) {
            const data = await pdfParse(buffer);
            const text = (data.text || "").trim();
            return { extractedText: text.slice(0, 500_000) };
        }
        if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            lower.endsWith(".docx")) {
            const { value } = await mammoth.extractRawText({ buffer });
            return { extractedText: (value || "").trim().slice(0, 500_000) };
        }
        if (mime === "application/msword" || lower.endsWith(".doc")) {
            return {
                extractedText: "",
                error: "Legacy .doc 暂不支持抽取正文，请改用 .docx 或 PDF。",
            };
        }
        if (IMAGE_TYPES.has(mime) || /\.(jpe?g|png|gif|webp)$/i.test(lower)) {
            return {
                extractedText: "",
                imageHint: `图片「${originalName}」(${mime}, ${buffer.length} bytes) — 需多模态/视觉模型分析，当前仅登记附件。`,
            };
        }
        return { extractedText: "", error: `不支持的类型: ${mime}` };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "extract failed";
        return { extractedText: "", error: msg };
    }
}
