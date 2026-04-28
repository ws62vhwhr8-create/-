"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, FolderKanban, Settings, Moon, Sun } from "lucide-react"
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

const menuItems = [
  // 대시보드는 User/Admin 그룹으로 이동
]

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
    title: "솔루션 관리",
    href: "/solutions",
    icon: FolderKanban,
  },
  {
    title: "사용자 관리",
    href: "/users",
    icon: Settings,
  },
  {
    title: "대시보드",
    href: "/",
    icon: LayoutDashboard,
  },
]

export function Navigation() {
  const pathname = usePathname()
  const { state } = useSidebar()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isActive = (href: string) => {
    return pathname === href || (href !== "/" && pathname.startsWith(href))
  }

  return (
    <Sidebar collapsible="all">
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
        <SidebarMenu>
          {menuItems.map((item) => (
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
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
