import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
const ALGORITHM = "aes-256-gcm";
function getKeyMaterial() {
    const raw = process.env.USER_SECRET_ENCRYPTION_KEY?.trim() || "";
    if (!raw) {
        throw new Error("USER_SECRET_ENCRYPTION_KEY is required");
    }
    return createHash("sha256").update(raw).digest();
}
export function encryptSecret(plainText) {
    const iv = randomBytes(12);
    const key = getKeyMaterial();
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}
export function decryptSecret(cipherText) {
    const payload = Buffer.from(cipherText, "base64");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const encrypted = payload.subarray(28);
    const key = getKeyMaterial();
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
}
export function maskSecret(secret) {
    const trimmed = secret.trim();
    if (!trimmed)
        return "";
    if (trimmed.length <= 8)
        return `${trimmed.slice(0, 2)}***`;
    return `${trimmed.slice(0, 4)}••••••${trimmed.slice(-4)}`;
}
