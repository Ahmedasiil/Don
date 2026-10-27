import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';
const formatDate = (_l: string, d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-CA', o);
const locale = () => 'en';
import { C, F, R, shadow } from '@/lib/theme';
import { T } from './ui';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

/** A date button that opens a month calendar. Value is YYYY-MM-DD. */
export function DateField({ label, value, onChange, min }: { label: string; value: string; onChange: (v: string) => void; min?: string }) {
  const [open, setOpen] = useState(false);
  const d = parse(value);
  return (
    <View style={{ gap: 7, flex: 1 }}>
      <T v="small" style={{ fontFamily: F.semi, color: C.text }}>{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}, ${formatDate(locale(), d, { dateStyle: 'full' })}`} onPress={() => setOpen(true)} style={({ pressed }) => [s.field, pressed && { borderColor: C.navy }]}>
        <CalendarDays color={C.blue} size={18} />
        <View style={{ flex: 1 }}>
          <Text style={s.value}>{formatDate(locale(), d, { month: 'short', day: 'numeric' })}</Text>
          <Text style={s.weekday}>{formatDate(locale(), d, { weekday: 'long' })}</Text>
        </View>
      </Pressable>
      <Calendar key={open ? value : "closed"} visible={open} value={value} min={min} onClose={() => setOpen(false)} onPick={(v) => { onChange(v); setOpen(false); }} title={label} />
    </View>
  );
}

function Calendar({ visible, value, min, onPick, onClose, title }: { visible: boolean; value: string; min?: string; onPick: (v: string) => void; onClose: () => void; title: string }) {
  const sel = parse(value);
  const [month, setMonth] = useState(new Date(sel.getFullYear(), sel.getMonth(), 1));
  const first = (month.getDay() + 6) % 7; // weeks start on Monday
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const today = iso(new Date());
  const weekdays = Array.from({ length: 7 }, (_, i) => formatDate(locale(), new Date(2024, 0, 1 + i), { weekday: 'narrow' }));
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable style={s.sheet} onPress={() => {}}>
          <T v="label">{title}</T>
          <View style={s.head}>
            <Pressable accessibilityLabel="Previous month" onPress={() => shift(-1)} style={s.nav} hitSlop={8}><ChevronLeft color={C.ink} size={20} /></Pressable>
            <T v="title" style={{ flex: 1, textAlign: 'center', fontSize: 18 }}>{formatDate(locale(), month, { month: 'long', year: 'numeric' })}</T>
            <Pressable accessibilityLabel="Next month" onPress={() => shift(1)} style={s.nav} hitSlop={8}><ChevronRight color={C.ink} size={20} /></Pressable>
          </View>
          <View style={s.grid}>
            {weekdays.map((w, i) => <Text key={'w' + i} style={s.wd}>{w}</Text>)}
            {cells.map((n, i) => {
              if (!n) return <View key={i} style={s.cell} />;
              const v = iso(new Date(month.getFullYear(), month.getMonth(), n));
              const on = v === value, isToday = v === today, off = !!min && v < min;
              return (
                <Pressable key={i} disabled={off} onPress={() => onPick(v)} style={s.cell} accessibilityState={{ selected: on, disabled: off }}>
                  <View style={[s.day, on && s.dayOn, !on && isToday && s.dayToday]}>
                    <Text style={[s.dayText, on && { color: '#fff' }, off && { color: C.faint }]}>{n}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  field: { minHeight: 58, borderWidth: 1, borderColor: C.line, borderRadius: R.md, backgroundColor: C.paper, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  value: { fontFamily: F.bold, fontSize: 15.5, color: C.ink },
  weekday: { fontFamily: F.medium, fontSize: 12, color: C.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(6,10,40,0.45)', justifyContent: 'center', padding: 20 },
  sheet: { backgroundColor: C.paper, borderRadius: R.xl, padding: 20, gap: 14, maxWidth: 420, width: '100%', alignSelf: 'center', ...shadow(3) },
  head: { flexDirection: 'row', alignItems: 'center' },
  nav: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  wd: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: F.bold, fontSize: 11.5, color: C.faint, paddingBottom: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: '84%', height: '84%', borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dayOn: { backgroundColor: C.navy },
  dayToday: { borderWidth: 1.5, borderColor: C.blue },
  dayText: { fontFamily: F.semi, fontSize: 15, color: C.ink },
});
