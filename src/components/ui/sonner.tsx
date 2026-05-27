"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 6500,
        classNames: {
          toast: "cn-toast !border-border/70 !bg-popover !text-popover-foreground !shadow-2xl !ring-1 !ring-foreground/10",
          title: "!font-semibold",
          description: "!text-muted-foreground",
          success: "!border-emerald-500/40 !bg-emerald-950/80 !text-emerald-100",
          error: "!border-red-500/50 !bg-red-950/80 !text-red-100",
          warning: "!border-amber-500/50 !bg-amber-950/80 !text-amber-100",
          info: "!border-sky-500/40 !bg-sky-950/80 !text-sky-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
