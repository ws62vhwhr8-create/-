"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useTheme } from "next-themes"
import { useAppStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, FolderKanban, Settings, Moon, Sun, LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  SidebarGroupLabel,
  SidebarGroup,
  useSidebar,
} from "@/components/ui/sidebar"

const userMenuItems = [
  {
    title: "고객 관리",
    href: "/customers",
    icon: Users,
  },
  {
    title: "대시보드",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
]

const adminMenuItems = [
  {
    title: "대시보드",
    href: "/admin-dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "솔루션(프로젝트) 관리",
    href: "/solutions",
    icon: FolderKanban,
  },
  {
    title: "사용자 관리",
    href: "/users",
    icon: Settings,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { data: session } = useSession()
  const { resolvedTheme, setTheme } = useTheme()
  const { users, currentUserId } = useAppStore()
  const [mounted, setMounted] = useState(false)

  const currentUser = users.find((user) => user.id === currentUserId)
  const isAdmin = session?.user?.role === "admin" || currentUser?.role === "admin"
  const accountName = session?.user?.name || currentUser?.displayName || "사용자"
  const accountEmail = session?.user?.email || currentUser?.email || ""
  const accountImage = session?.user?.image || ""
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "U"

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href))
  }

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-[#d9d1f0] bg-[linear-gradient(180deg,#fdfcff_0%,#f7f4ff_55%,#f4f3ff_100%)] dark:bg-[linear-gradient(180deg,#161616_0%,#131313_100%)] dark:border-[#262626]"
    >
      <SidebarHeader className="h-24 !gap-0 !py-0 justify-center">
        <Link
          href="/"
          className={cn(
            "relative top-1 flex h-full items-center -translate-x-[1.1px] translate-y-[1.1px]",
            state === "collapsed" ? "justify-center px-0" : "justify-start px-2",
          )}
        >
          {state === "collapsed" ? (
              <div className="flex h-8 w-8 origin-left scale-[1.35] items-center justify-center rounded-lg border border-[#dbd6f0] bg-[#f3f1ff] shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/15">
              <FolderKanban className="h-4 w-4 text-[#4f46e5] dark:text-indigo-400" />
            </div>
          ) : (
            <div className="origin-left scale-[1.35]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dbd6f0] bg-[#f3f1ff] shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/15">
                  <FolderKanban className="h-4 w-4 text-[#4f46e5] dark:text-indigo-400" />
                </div>
                <span className="text-lg leading-none font-bold text-[#1e1b4b] dark:text-indigo-400 block truncate tracking-tight">영업 로드맵</span>
              </div>
              <p className="mt-0.5 text-[10px] text-[#6360a0] dark:text-neutral-500 uppercase tracking-widest font-medium">Management Portal</p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent className="[&_[data-sidebar=menu-button]]:rounded-xl [&_[data-sidebar=menu-button]]:px-2.5 [&_[data-sidebar=menu-button]]:py-2 [&_[data-sidebar=menu-button]]:font-medium">
        <SidebarSeparator className="my-0.5" />

        <SidebarGroup>
          <SidebarGroupLabel>User</SidebarGroupLabel>
          <SidebarMenu>
            {userMenuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
                  className="rounded-xl transition-all duration-150 hover:bg-[#f1edff] hover:text-[#433c7a] data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:shadow-[inset_0_0_0_1px_rgba(79,70,229,0.28)] dark:data-[active=true]:bg-indigo-500/15 dark:data-[active=true]:text-indigo-400 dark:data-[active=true]:shadow-[inset_0_0_0_1px_rgba(192,193,255,0.28)]"
                >
                  <Link href={item.href}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href)}
                    className="rounded-xl transition-all duration-150 hover:bg-[#f1edff] hover:text-[#433c7a] data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-medium data-[active=true]:shadow-[inset_0_0_0_1px_rgba(79,70,229,0.28)] dark:data-[active=true]:bg-indigo-500/15 dark:data-[active=true]:text-indigo-400 dark:data-[active=true]:shadow-[inset_0_0_0_1px_rgba(192,193,255,0.28)]"
                  >
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarSeparator className="mt-auto mb-0" />
        <SidebarGroup className="pt-0 pb-0">
          <div className="space-y-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  type="button"
                  className="-mt-[5px]"
                  onClick={() => setTheme(mounted && resolvedTheme === "dark" ? "light" : "dark")}
                >
                  {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>{mounted && resolvedTheme === "dark" ? "다크모드 Off" : "다크모드 On"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="rounded-xl border border-[#d9d1f0] bg-white/85 p-2.5 shadow-[0_16px_32px_-28px_rgba(79,70,229,0.65)] dark:border-neutral-700/50 dark:bg-neutral-900/80">
            <div className={cn("flex items-center", state === "collapsed" ? "justify-center" : "gap-2.5") }>
              <Avatar className="h-8 w-8 ring-2 ring-border/50">
                <AvatarImage src={accountImage} alt={accountName} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold dark:bg-indigo-500/20 dark:text-indigo-400">{accountInitial}</AvatarFallback>
              </Avatar>

              {state !== "collapsed" && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground leading-tight">{accountName}</p>
                  <p className="truncate text-[11px] text-muted-foreground/70 mt-0.5">{accountEmail}</p>
                </div>
              )}
            </div>

            {state !== "collapsed" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2.5 w-full justify-center text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-xs">로그아웃</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-2 w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">로그아웃</span>
              </Button>
            )}
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
