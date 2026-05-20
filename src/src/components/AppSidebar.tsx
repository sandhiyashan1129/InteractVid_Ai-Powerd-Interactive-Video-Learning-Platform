import { NavLink, useLocation } from "react-router-dom";
import { Home, Upload, BookOpen, FileText, Brain, BarChart3, MessageCircle, Settings, PlayCircle, GraduationCap, Trophy, User, Award } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const main = [
  { title: "Home", url: "/", icon: Home },
  { title: "Upload Video", url: "/upload", icon: Upload },
  { title: "My Learning", url: "/learning", icon: BookOpen },
  { title: "AI Notes", url: "/notes", icon: FileText },
  { title: "AI Quiz", url: "/quiz", icon: Brain },
  { title: "Progress Analytics", url: "/progress", icon: BarChart3 },
  { title: "Leaderboard", url: "/leaderboard", icon: Trophy },
  { title: "Achievements", url: "/achievements", icon: Award },
  { title: "Chat Assistant", url: "/chat", icon: MessageCircle },
];

const secondary = [
  { title: "My Profile", url: "/profile", icon: User },
  { title: "Teacher Analytics", url: "/teacher", icon: GraduationCap },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (url: string) => url === "/" ? pathname === "/" : pathname.startsWith(url);

  const item = (i: typeof main[number]) => (
    <SidebarMenuItem key={i.url}>
      <SidebarMenuButton asChild>
        <NavLink to={i.url} end={i.url === "/"} className={({isActive: a}) =>
          `relative flex items-center gap-3 rounded-lg px-3 py-2 transition-smooth ${
            a || isActive(i.url)
              ? "bg-sidebar-accent text-primary font-semibold before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-gradient-neon before:glow-cyan"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-primary"
          }`
        }>
          <i.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-sm">{i.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent className="bg-sidebar">
        <div className={`flex items-center gap-2 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-9 w-9 rounded-lg bg-gradient-neon grid place-items-center glow-cyan shrink-0">
            <PlayCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <div className="font-display font-bold text-sm neon-text leading-tight">IntractctVid</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Learning</div>
            </div>
          )}
        </div>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>{main.map(item)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">More</SidebarGroupLabel>}
          <SidebarGroupContent><SidebarMenu>{secondary.map(item)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
