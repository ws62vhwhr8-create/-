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
    title: "솔루션 관리",
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
  const isAdmin = currentUser?.role === "admin"
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
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-24 !gap-0 !py-0 justify-center">
        <Link
          href="/"
          className={cn(
            "relative top-1 flex h-full items-center -translate-x-[1.1px] translate-y-[1.1px]",
            state === "collapsed" ? "justify-center px-0" : "justify-start px-2",
          )}
        >
          {state === "collapsed" ? (
            <div className="flex h-8 w-8 origin-left scale-[1.35] items-center justify-center rounded-lg bg-primary dark:bg-indigo-500/20 dark:border dark:border-indigo-500/30">
              <FolderKanban className="h-4 w-4 text-primary-foreground dark:text-indigo-500" />
            </div>
          ) : (
            <div className="origin-left scale-[1.35]">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary dark:bg-indigo-500/20 dark:border dark:border-indigo-500/30">
                  <FolderKanban className="h-4 w-4 text-primary-foreground dark:text-indigo-500" />
                </div>
                <span className="text-lg leading-none font-semibold text-foreground dark:text-indigo-500 block truncate">영업 로드맵</span>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground dark:text-neutral-500 uppercase tracking-wider font-semibold">Management Portal</p>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSeparator className="my-0.5" />

        <SidebarGroup>
          <SidebarGroupLabel>User</SidebarGroupLabel>
          <SidebarMenu>
            {userMenuItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(item.href)}
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

        <SidebarSeparator className="mt-auto mb-2" />
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                type="button"
                onClick={() => setTheme(mounted && resolvedTheme === "dark" ? "light" : "dark")}
              >
                {mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{mounted && resolvedTheme === "dark" ? "다크모드 Off" : "다크모드 On"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
            <div className={cn("flex items-center", state === "collapsed" ? "justify-center" : "gap-2") }>
              <Avatar className="h-9 w-9">
                <AvatarImage src={accountImage} alt={accountName} />
                <AvatarFallback>{accountInitial}</AvatarFallback>
              </Avatar>

              {state !== "collapsed" && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{accountName}</p>
                  <p className="truncate text-xs text-muted-foreground">{accountEmail}</p>
                </div>
              )}
            </div>

            {state !== "collapsed" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-full justify-center"
                onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
              >
                <LogOut className="h-4 w-4" />
                로그아웃
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-2 w-full"
                onClick={() => signOut({ callbackUrl: "/api/auth/signin" })}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">로그아웃</span>
              </Button>
            )}
          </div>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
