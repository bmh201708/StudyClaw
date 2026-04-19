import { Bell, CalendarDays, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useLanguage } from "../contexts/LanguageContext";

type NotificationItem = {
  id: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  dateLabel: string;
};

const notifications: NotificationItem[] = [
  {
    id: "recent-updates-apr-2026",
    titleZh: "近期更新",
    titleEn: "Recent updates",
    bodyZh:
      "StudyClaw 最近已接入 credits 与订阅页面、个人中心增强、Workflow Assistant 对话，以及更完整的本地开发链路。",
    bodyEn:
      "StudyClaw recently added credits and pricing, a richer profile center, Workflow Assistant chat, and a more complete local development flow.",
    dateLabel: "2026-04-20",
  },
];

export function NotificationsPage() {
  const { language } = useLanguage();

  return (
    <div className="space-y-8 text-[#2d3436]" style={{ fontFamily: '"Nunito", ui-sans-serif, system-ui, sans-serif' }}>
      <section className="relative overflow-hidden rounded-[2.5rem] border-4 border-white bg-white/95 px-6 py-7 shadow-[0_18px_0_rgba(0,0,0,0.03)] sm:px-8">
        <div className="pointer-events-none absolute -top-8 left-16 h-52 w-52 rounded-full bg-[#ff9d8d]/12 blur-[90px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#a8e6cf]/12 blur-[100px]" />
        <div className="relative flex flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d8efe6] bg-[#f2fbf6] px-4 py-1.5 text-sm font-bold text-[#4e9a7f]">
            <Bell className="h-4 w-4" />
            {language === "zh" ? "通知中心" : "Notification Center"}
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-[0.95] sm:text-5xl [font-family:Fredoka,sans-serif]">
              {language === "zh" ? "你的最新" : "Your latest"}
              <br />
              <span className="italic text-[#ff9d8d]">{language === "zh" ? "产品动态" : "product updates"}</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[#636e72]">
              {language === "zh"
                ? "这里先展示一条近期更新，后续可以继续扩展成完整的通知列表。"
                : "This page starts with a single recent update and can grow into a full notification feed later."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6">
        {notifications.length > 0 ? (
          notifications.map((item) => (
            <Card
              key={item.id}
              className="rounded-[2rem] border-4 border-white bg-white/95 shadow-[0_16px_0_rgba(0,0,0,0.03)]"
            >
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#ffe1d7] bg-[#fff3ef] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#c86d5d]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {language === "zh" ? "近期更新" : "Recent updates"}
                    </div>
                    <CardTitle className="text-2xl [font-family:Fredoka,sans-serif]">
                      {language === "zh" ? item.titleZh : item.titleEn}
                    </CardTitle>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#f7fbfe] px-3 py-1.5 text-xs font-bold text-[#7a97ab]">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {item.dateLabel}
                  </div>
                </div>
                <CardDescription className="text-sm leading-relaxed text-[#6f787c]">
                  {language === "zh" ? item.bodyZh : item.bodyEn}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-relaxed text-[#5a6467]">
                {language === "zh"
                  ? "这条通知会帮助你了解最近新增的能力，尤其是 credits、订阅、个人中心和工作流辅助等模块。"
                  : "This update highlights the latest capabilities across credits, pricing, the profile center, and workflow assistance."}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="rounded-[2rem] border-4 border-dashed border-[#edf1f5] bg-white/80 shadow-[0_12px_0_rgba(0,0,0,0.02)]">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center">
              <Bell className="h-8 w-8 text-[#a8b3b8]" />
              <p className="text-lg font-bold [font-family:Fredoka,sans-serif]">
                {language === "zh" ? "暂时还没有通知" : "No notifications yet"}
              </p>
              <p className="max-w-md text-sm leading-relaxed text-[#7b8489]">
                {language === "zh"
                  ? "新的产品更新、账户提醒或学习动态之后都可以汇总到这里。"
                  : "Future product updates, account reminders, and learning activity notices can all live here."}
              </p>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
