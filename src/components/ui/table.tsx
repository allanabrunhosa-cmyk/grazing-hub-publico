"use client"

import * as React from "react"
import { ChevronsUpDown, ArrowUp, ArrowDown } from "lucide-react"
import { cn } from "cn"
import { useTabelaResponsiva } from "./table-responsiva"

function Table({ className, identificationColumn, ref, ...props }: React.ComponentProps<"table"> & { identificationColumn?: number | null }) {
  const { scrollport: areaRef, table: tabelaRef } = useTabelaResponsiva(identificationColumn)
  React.useImperativeHandle(ref, () => tabelaRef.current!, [tabelaRef])
  return (
    <div
      data-slot="table-container"
      ref={areaRef}
      role="region"
      aria-label={props["aria-label"] ?? "Tabela rolável"}
      tabIndex={0}
      className="relative min-w-0 max-w-full w-full overflow-auto outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <table
        data-slot="table"
        ref={tabelaRef}
        className={cn("w-full caption-bottom text-[13px]", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] has-aria-expanded:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))] data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium tracking-normal whitespace-normal text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

// Cabeçalho clicável de coluna ordenável — label + indicador de direção, no
// padrão do Nina (setinhas discretas ao lado do texto, ganham destaque quando ativas).
function SortableTableHead({
  className,
  children,
  active,
  direction = "asc",
  onClick,
  ...props
}: React.ComponentProps<"th"> & {
  active?: boolean
  direction?: "asc" | "desc"
  onClick?: () => void
}) {
  return (
    <TableHead aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"} className={cn("p-0", className)} {...props}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-9 w-full items-center gap-1 px-3 py-2 text-left transition-colors hover:text-foreground [&_svg]:shrink-0",
          active && "text-foreground"
        )}
      >
        {children}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-50" />
        )}
      </button>
    </TableHead>
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-3 align-middle text-[13px] whitespace-normal [&:has([role=checkbox])]:pr-0",
        className,
        /\b(text-right|tabular-nums)\b/.test(className ?? "") && !className?.includes("whitespace-normal") && "whitespace-nowrap"
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  SortableTableHead,
  TableRow,
  TableCell,
  TableCaption,
}
