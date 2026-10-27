"use client";
import { useState } from "react";
import { useApi } from "@/lib/client/api";
import { dateTime } from "@/lib/format";
import { Badge, ErrorNote, Loading, PageHeader, Tabs } from "@/components/ui";
import { SearchBox, Table, useDebounced } from "../bits";

type R = { id: string; action: string; actor: string | null; entity: string | null; entityId: string | null; ip: string | null; data: unknown; createdAt: string; user: { name: string; email: string } | null };

export default function Audit() {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState<"" | "admin">("");
  const dq = useDebounced(q);
  const { data, error, reload } = useApi<{ rows: R[] }>(`/api/admin/audit?q=${encodeURIComponent(dq)}&actor=${actor}`);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Platform" title="Audit log" sub="Every sign-in, money action and admin decision, with who did it. Kept for regulators; it can't be edited." />
      <div className="flex flex-wrap items-center gap-3"><SearchBox value={q} onChange={setQ} placeholder="Action, e.g. pay.transfer or customer.adjust" /><Tabs value={actor} onChange={setActor} tabs={[{ key: "", label: "Everything" }, { key: "admin", label: "Admin actions" }]} /></div>
      {error ? <ErrorNote error={error} onRetry={reload} /> : !data ? <Loading rows={10} /> : (
        <div className="card overflow-hidden"><Table head={["When", "Who", "Action", "On", "Details"]} empty={!data.rows.length}>
          {data.rows.map((r) => <tr key={r.id} className="align-top">
            <td className="whitespace-nowrap px-5 py-3 text-muted">{dateTime(r.createdAt)}</td>
            <td className="px-5 py-3"><b>{r.user?.name ?? "System"}</b>{r.actor === "super-admin" && <Badge tone="blue" className="ms-1">Admin</Badge>}<small className="block text-muted">{r.user?.email}{r.ip ? ` · ${r.ip}` : ""}</small></td>
            <td className="px-5 py-3 font-mono text-[12.5px]">{r.action}</td>
            <td className="px-5 py-3 text-muted">{r.entity}{r.entityId ? ` ${r.entityId.slice(-8)}` : ""}</td>
            <td className="max-w-[360px] px-5 py-3"><code className="block truncate text-[11.5px] text-muted" title={JSON.stringify(r.data)}>{r.data ? JSON.stringify(r.data) : ""}</code></td>
          </tr>)}
        </Table></div>
      )}
    </div>
  );
}
