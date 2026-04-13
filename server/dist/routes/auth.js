import { Router } from "express";
import { loginUser, readBearerToken, registerUser, requireUser, revokeToken } from "../auth.js";
export const authRouter = Router();
function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}
function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
authRouter.post("/register", async (req, res) => {
    const name = normalizeText(req.body?.name);
    const email = normalizeText(req.body?.email).toLowerCase();
    const password = normalizeText(req.body?.password);
    if (name.length < 2) {
        res.status(400).json({ error: "name must be at least 2 characters" });
        return;
    }
    if (!validEmail(email)) {
        res.status(400).json({ error: "valid email is required" });
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: "password must be at least 8 characters" });
        return;
    }
    try {
        const session = await registerUser({ name, email, password });
        res.status(201).json(session);
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "23505") {
            res.status(409).json({ error: "email already registered" });
            return;
        }
        console.error("[auth/register]", error);
        res.status(500).json({ error: "failed to register user" });
    }
});
authRouter.post("/login", async (req, res) => {
    const email = normalizeText(req.body?.email).toLowerCase();
    const password = normalizeText(req.body?.password);
    if (!validEmail(email) || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
    }
    try {
        const session = await loginUser({ email, password });
        if (!session) {
            res.status(401).json({ error: "invalid email or password" });
            return;
        }
        res.json(session);
    }
    catch (error) {
        console.error("[auth/login]", error);
        res.status(500).json({ error: "failed to login" });
    }
});
authRouter.get("/me", async (req, res) => {
    const user = await requireUser(req, res);
    if (!user)
        return;
    res.json({ user });
});
authRouter.post("/logout", async (req, res) => {
    const token = readBearerToken(req);
    if (token) {
        await revokeToken(token).catch((error) => {
            console.error("[auth/logout]", error);
        });
    }
    res.status(204).end();
});
