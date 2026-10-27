import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { C, F } from '@/lib/theme';
import { Button, ErrorText, Input, T } from './ui';
import { errCode } from '@/lib/pay';

/** Bottom sheet to confirm a money move: PIN always, plus an authenticator code when asked. */
export function PinSheet({ visible, title, summary, needCode, codeOnly, onClose, onConfirm }: { visible: boolean; title: string; summary?: React.ReactNode; needCode?: boolean; codeOnly?: boolean; onClose: () => void; onConfirm: (pin: string, code?: string) => Promise<void> }) {
  const [pin, setPin] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    setBusy(true); setErr(null);
    try { await onConfirm(pin, code || undefined); setPin(''); setCode(''); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };
  const ready = (codeOnly || pin.length === 6) && (!(needCode || codeOnly) || code.length >= 6);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={st.sheet}>
          <View style={st.grip} />
          <T v="title">{title}</T>
          {summary && <View style={st.summary}>{summary}</View>}
          {!codeOnly && <Input label="Your 6-digit oenodpay PIN" value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" secureTextEntry maxLength={6} autoFocus style={st.pin} icon={<Lock color={C.muted} size={18} />} />}
          {(needCode || codeOnly) && <Input label="Code from your authenticator app" value={code} onChangeText={(v) => setCode(v.trim())} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={11} autoFocus={codeOnly} style={st.pin} icon={<ShieldCheck color={C.muted} size={18} />} />}
          <ErrorText text={err} />
          <Button title="Confirm" variant="primary" big loading={busy} disabled={!ready} onPress={go} />
          <T v="small" color={C.muted} style={{ textAlign: 'center' }}>oenodpay will never ask for your PIN or codes.</T>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,9,56,0.45)' },
  sheet: { backgroundColor: C.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 36, gap: 14 },
  grip: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.line, marginBottom: 4 },
  summary: { backgroundColor: C.bg, borderRadius: 16, padding: 14, gap: 6 },
  pin: { fontFamily: F.display, fontSize: 22, letterSpacing: 8, textAlign: 'center' },
});

/** PinSheet that asks for the authenticator code by itself when the server wants one. */
export function MoneySheet({ visible, title, summary, onClose, run }: { visible: boolean; title: string; summary?: React.ReactNode; onClose: () => void; run: (pin: string, code?: string) => Promise<void> }) {
  const [needCode, setNeedCode] = useState(false);
  return <PinSheet visible={visible} title={title} summary={summary} needCode={needCode} onClose={() => { setNeedCode(false); onClose(); }} onConfirm={async (pin, code) => {
    try { await run(pin, code); setNeedCode(false); }
    catch (e) { if (errCode(e) === 'STEP_UP_REQUIRED') { setNeedCode(true); throw new Error('Enter the code from your authenticator app to finish.'); } throw e; }
  }} />;
}

/** One line in a confirm summary. */
export const Line = ({ k, v }: { k: string; v?: string | null }) => <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><T v="small">{k}</T><T v="bodyStrong" style={{ fontSize: 14, flexShrink: 1, textAlign: 'right' }}>{v ?? ''}</T></View>;
