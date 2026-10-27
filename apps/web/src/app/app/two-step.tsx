"use client";
import { useState } from "react";
import { Copy, Download } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button, Input, Modal, useToast } from "@/components/ui";

/** Turn on two-step sign-in without leaving oenodpay: scan, confirm, save recovery codes. */
export function TwoStepSetup({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [setup, setSetup] = useState<{ secret: string; qrSvg: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const start = async () => { setBusy(true); try { setSetup(await api("/api/account/security/2fa/setup", { body: {} })); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  const confirm = async () => { setBusy(true); try { const r = await api<{ recoveryCodes: string[] }>("/api/account/security/2fa/enable", { body: { code } }); setCodes(r.recoveryCodes); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); } };
  const close = () => { if (codes) onDone(); setSetup(null); setCode(""); setCodes(null); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Turn on two-step sign-in" footer={codes ? <Button variant="pri" onClick={close}>I saved my codes</Button> : setup ? <Button variant="pri" loading={busy} disabled={code.length !== 6} onClick={confirm}>Turn on</Button> : <Button variant="pri" loading={busy} onClick={start}>Start</Button>}>
      {codes ? (
        <div className="space-y-3">
          <p className="text-[14px]">Two-step sign-in is on. Save these recovery codes somewhere safe. Each works once if you lose your phone.</p>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F7F8FA] p-3 font-mono text-[13px]">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <div className="flex gap-2"><Button size="sm" onClick={() => { navigator.clipboard.writeText(codes.join("\n")); toast("Copied", "ok"); }}><Copy className="h-4 w-4" />Copy</Button><Button size="sm" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([`oenodpay recovery codes\n\n${codes.join("\n")}\n`], { type: "text/plain" })); a.download = "oenodpay-recovery-codes.txt"; a.click(); }}><Download className="h-4 w-4" />Download</Button></div>
        </div>
      ) : setup ? (
        <div className="space-y-4 text-center">
          <p className="text-[14px] text-[#667085]">Scan with Google Authenticator, Microsoft Authenticator, 1Password or any authenticator app.</p>
          <div className="mx-auto h-48 w-48 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: setup.qrSvg }} />
          <p className="font-mono text-[12px] text-[#667085]">Or type this key: {setup.secret}</p>
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code" className="h-12 text-center font-mono text-xl tracking-[.4em]" autoFocus />
        </div>
      ) : (
        <p className="text-[14px] text-[#667085]">You'll need an authenticator app on your phone. After this, signing in on a new device and confirming big payments will ask for a 6-digit code from the app, so a stolen password alone can't touch your money.</p>
      )}
    </Modal>
  );
}
