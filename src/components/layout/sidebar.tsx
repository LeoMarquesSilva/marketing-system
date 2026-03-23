"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  List,
  Link2,
  Users,
  Columns3,
  ClipboardList,
  LogOut,
  Settings,
  Sparkles,
  Newspaper,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { fetchCommentStats } from "@/lib/request-comments";
import { fetchMarketingRequests } from "@/lib/marketing-requests";

const baseNavItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/planner", icon: Columns3, label: "Planner" },
  { href: "/solicitacoes", icon: List, label: "Solicitações" },
  { href: "/conteudo/roteiros", icon: Newspaper, label: "Conteúdo para Post" },
  { href: "/vibe-marketing", icon: Sparkles, label: "Vibe Marketing" },
  { href: "/clima", icon: Heart, label: "Clima" },
  { href: "/vios-tarefas", icon: ClipboardList, label: "Tarefas VIOS" },
  { href: "/vincular-solicitantes", icon: Link2, label: "Vincular Solicitantes" },
  { href: "/usuarios", icon: Users, label: "Usuários" },
];

const adminNavItems = [
  { href: "/admin", icon: Settings, label: "Configurações" },
  { href: "/admin/conteudo-temas", icon: Newspaper, label: "Temas RSS" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };
  const [pendingAlterations, setPendingAlterations] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const requests = await fetchMarketingRequests({ userId: profile.id, role: profile.role as "designer" | "admin" | "solicitante" });
      if (requests.length === 0) return;
      const ids = requests.map((r) => r.id);
      const { pendingAlterationsCounts } = await fetchCommentStats(ids);
      const total = Object.values(pendingAlterationsCounts).reduce((sum, n) => sum + n, 0);
      setPendingAlterations(total);
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [profile?.id, profile?.role]);

  return (
    <>
    <aside
      className={cn(
        // Hidden on mobile, visible md+
        "hidden md:flex",
        "fixed left-0 top-0 z-40 h-screen w-16 flex-col items-center",
        "bg-gradient-to-b from-[#101f2e] to-[#0a141c]",
        "border-r border-white/[0.06]",
        "shadow-[1px_0_20px_rgba(0,0,0,0.15)]",
        "py-4 gap-0"
      )}
    >
      {/* Logo mark — fênix */}
      <Link
        href="/"
        className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
        title="Início"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/fenix.png"
          alt="Bismarchi Pires"
          width={28}
          height={28}
          className="object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.4)]"
        />
      </Link>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col items-center gap-1 w-full px-3" aria-label="Navegação principal">
        {[...baseNavItems, ...(profile?.role === "admin" ? adminNavItems : [])].map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                isActive
                  ? "bg-white shadow-[0_2px_16px_rgba(0,0,0,0.25)] text-[#101f2e]"
                  : "text-white/40 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon
                className={cn(
                  "h-[18px] w-[18px] transition-transform duration-200",
                  "group-hover:scale-110",
                  isActive ? "text-[#101f2e]" : ""
                )}
              />
              {item.href === "/planner" && pendingAlterations > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-[#101f2e] px-1 leading-none shadow-sm">
                  {pendingAlterations > 9 ? "9+" : pendingAlterations}
                </span>
              )}

              {/* Tooltip */}
              <span
                className={cn(
                  "pointer-events-none absolute left-full ml-3 whitespace-nowrap",
                  "rounded-lg border border-white/10 bg-[#101f2e]/95 backdrop-blur-xl",
                  "px-3 py-1.5 text-xs font-medium text-white shadow-xl",
                  "opacity-0 -translate-x-1 scale-95",
                  "group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100",
                  "transition-all duration-150 z-50"
                )}
                aria-hidden
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="w-8 border-t border-white/10 my-3 shrink-0" />

      {/* Bottom: avatar + sign out */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        {profile && (
          <Link
            href="/perfil"
            title={profile.name}
            aria-label={`Meu perfil — ${profile.name}`}
            className="group relative"
          >
            <Avatar className="h-8 w-8 border-2 border-white/20 hover:border-white/40 transition-colors shadow-sm">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] font-semibold bg-white/10 text-white">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[#0a141c]" aria-hidden />
            {/* Tooltip */}
            <span
              className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg border border-white/10 bg-[#101f2e]/95 backdrop-blur-xl px-3 py-1.5 text-xs font-medium text-white shadow-xl opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50"
              aria-hidden
            >
              {profile.name}
            </span>
          </Link>
        )}

        <button
          onClick={handleSignOut}
          title="Sair"
          aria-label="Sair da conta"
          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/30 hover:bg-white/10 hover:text-white/70 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>

    {/* Mobile bottom navigation */}
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around bg-gradient-to-r from-[#101f2e] to-[#0a141c] border-t border-white/[0.06] h-16 px-2 shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
      {[...baseNavItems, ...(profile?.role === "admin" ? adminNavItems : [])].slice(0, 5).map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all",
              isActive ? "text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[9px] font-medium leading-none">{item.label.split(" ")[0]}</span>
            {item.href === "/planner" && pendingAlterations > 0 && (
              <span className="absolute top-1 right-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-[#101f2e] px-0.5">
                {pendingAlterations > 9 ? "9+" : pendingAlterations}
              </span>
            )}
          </Link>
        );
      })}
      <button
        onClick={handleSignOut}
        className="flex flex-col items-center gap-1 px-3 py-2 text-white/40 hover:text-red-400 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        <span className="text-[9px] font-medium leading-none">Sair</span>
      </button>
    </nav>

    {/* Mobile bottom padding to avoid content hidden behind nav */}
    <div className="md:hidden h-16" />
    </>
  );
}
