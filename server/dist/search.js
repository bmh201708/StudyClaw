const SEARCH_ENDPOINT = "https://html.duckduckgo.com/html/";
function inferKind(url) {
    const normalized = url.toLowerCase();
    if (normalized.endsWith(".pdf") ||
        normalized.includes("/docs") ||
        normalized.includes("developer.mozilla.org") ||
        normalized.includes("wikipedia.org") ||
        normalized.includes("w3.org")) {
        return "doc";
    }
    return "site";
}
function decodeHtml(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}
function stripTags(value) {
    return decodeHtml(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function unwrapDuckDuckGoUrl(rawUrl) {
    const decoded = decodeHtml(rawUrl);
    const withProtocol = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    try {
        const url = new URL(withProtocol);
        const redirected = url.searchParams.get("uddg");
        return redirected ? decodeURIComponent(redirected) : withProtocol;
    }
    catch {
        return withProtocol;
    }
}
function buildFallbackRecommendations(query, taskTitle, language) {
    const encoded = encodeURIComponent(query);
    return [
        {
            title: `${taskTitle} · Google`,
            description: language === "zh" ? "Google 实时搜索入口" : "Live Google search entry",
            url: `https://www.google.com/search?q=${encoded}`,
            kind: "site",
            source: "fallback",
        },
        {
            title: `${taskTitle} · Documentation`,
            description: language === "zh" ? "面向当前子任务的文档搜索" : "Documentation search for the current subtask",
            url: `https://www.google.com/search?q=${encoded}+documentation`,
            kind: "doc",
            source: "fallback",
        },
        {
            title: `${taskTitle} · Tutorial`,
            description: language === "zh" ? "面向当前子任务的教程搜索" : "Tutorial search for the current subtask",
            url: `https://www.google.com/search?q=${encoded}+tutorial`,
            kind: "site",
            source: "fallback",
        },
    ];
}
function parseDuckDuckGoResults(html) {
    const results = [];
    const anchorRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    for (const match of html.matchAll(anchorRegex)) {
        const url = unwrapDuckDuckGoUrl(match[1]);
        const title = stripTags(match[2]);
        if (!url || !title)
            continue;
        if (results.some((item) => item.url === url))
            continue;
        results.push({
            title,
            url,
            kind: inferKind(url),
        });
        if (results.length >= 3)
            break;
    }
    return results;
}
export async function fetchTaskRecommendations(taskTitle, goal, language = "zh") {
    const trimmedTask = taskTitle.trim();
    const trimmedGoal = goal?.trim() ?? "";
    const query = [trimmedTask, trimmedGoal].filter(Boolean).join(" ").trim();
    if (!trimmedTask) {
        return { query: "", items: [] };
    }
    try {
        const response = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 StudyClaw/1.0",
            },
        });
        if (!response.ok) {
            throw new Error(`duckduckgo search failed: ${response.status}`);
        }
        const html = await response.text();
        const parsed = parseDuckDuckGoResults(html);
        if (parsed.length > 0) {
            return {
                query,
                items: parsed.map((item) => ({
                    ...item,
                    description: language === "zh"
                        ? `围绕“${trimmedTask}”的实时搜索结果`
                        : `Live search result for "${trimmedTask}"`,
                    source: "search",
                })),
            };
        }
    }
    catch (error) {
        console.warn("[task-recommendations]", error);
    }
    return {
        query,
        items: buildFallbackRecommendations(query, trimmedTask, language),
    };
}
