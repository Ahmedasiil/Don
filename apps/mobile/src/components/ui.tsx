import { createContext, useContext, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Info } from 'lucide-react-native';
import { C, F, G, R, shadow } from '@/lib/theme';

/** A platform notice from super admin (banner or view-only mode), shown at the top of every screen. */
export const NoticeContext = createContext<string | null>(null);
export function Notice() {
  const n = useContext(NoticeContext);
  if (!n) return null;
  return (
    <View style={s.notice}>
      <Info color="#fff" size={15} />
      <Text style={s.noticeText}>{n}</Text>
    </View>
  );
}

// ─── Type ────────────────────────────────────────────────────────────────────

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'label' | 'number';
const TYPE: Record<Variant, TextStyle> = {
  display: { fontFamily: F.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: C.ink },
  title: { fontFamily: F.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3, color: C.ink },
  heading: { fontFamily: F.bold, fontSize: 16, lineHeight: 22, color: C.ink },
  body: { fontFamily: F.regular, fontSize: 15, lineHeight: 22, color: C.text },
  bodyStrong: { fontFamily: F.semi, fontSize: 15, lineHeight: 21, color: C.ink },
  small: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.muted },
  caption: { fontFamily: F.medium, fontSize: 12, lineHeight: 16, color: C.muted },
  label: { fontFamily: F.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.3, textTransform: 'uppercase', color: C.muted },
  number: { fontFamily: F.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.5, color: C.ink, fontVariant: ['tabular-nums'] },
};
export function T({ v = 'body', color, style, ...p }: TextProps & { v?: Variant; color?: string }) {
  return <Text {...p} style={[TYPE[v], color ? { color } : null, style]} />;
}
// Older names kept for screens that use them.
export const H1 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => <T v="display" style={style}>{children}</T>;
export const Eyebrow = ({ children, color }: { children: React.ReactNode; color?: string }) => <T v="label" color={color}>{children}</T>;
export const Body = ({ children, style, muted }: { children: React.ReactNode; style?: TextStyle; muted?: boolean }) => <T v="body" color={muted ? C.muted : undefined} style={style}>{children}</T>;

// ─── Layout ──────────────────────────────────────────────────────────────────

type ScreenProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  right?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
};
export function Screen({ children, title, subtitle, eyebrow, right, refreshing, onRefresh, padded = true, edges = ['top'] }: ScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={edges}>
      <Notice />
      <ScrollView
        contentContainerStyle={[padded && { paddingHorizontal: 20, paddingTop: 12, gap: 18 }, { paddingBottom: 48 }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.navy} /> : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {(title || right) && <ScreenHeader title={title} subtitle={subtitle} eyebrow={eyebrow} right={right} />}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeader({ title, subtitle, eyebrow, right }: { title?: string; subtitle?: string; eyebrow?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 6 }}>
      <View style={{ flex: 1, gap: 4 }}>
        {eyebrow ? <T v="label">{eyebrow}</T> : null}
        {title ? <T v="display" accessibilityRole="header">{title}</T> : null}
        {subtitle ? <T v="small" style={{ fontSize: 14 }}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}

/** A titled block with an optional link on the right ("See all"). */
export function Section({ title, action, onAction, children, style }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
        <T v="title" style={{ fontSize: 17 }}>{title}</T>
        {action && onAction ? <Pressable hitSlop={10} onPress={onAction}><T v="small" color={C.blue} style={{ fontFamily: F.bold }}>{action}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style, title, action, padded = true, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; title?: string; action?: React.ReactNode; padded?: boolean; onPress?: () => void }) {
  const inner = <>
    {(title || action) && <View style={s.cardHead}>{title ? <T v="heading">{title}</T> : <View />}{action}</View>}
    {children}
  </>;
  if (onPress) return <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.card, padded && { padding: 18 }, style, pressed && { opacity: 0.85 }]}>{inner}</Pressable>;
  return <View style={[s.card, padded && { padding: 18 }, style]}>{inner}</View>;
}

/** Deep navy surface with a soft gradient and two faint rings, used for the one thing that matters most on a screen. */
export function HeroCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.hero, style]}>
      <LinearGradient colors={G.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[s.ring, { width: 260, height: 260, top: -120, right: -90 }]} />
      <View pointerEvents="none" style={[s.ring, { width: 170, height: 170, top: -60, right: -30, opacity: 0.6 }]} />
      <View style={{ padding: 22, gap: 12 }}>{children}</View>
    </View>
  );
}
export const NavyCard = HeroCard;

// ─── Controls ────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger' | 'light' | 'glass' | 'pri' | 'default';
const BTN: Record<string, [string, string, string]> = {
  primary: [C.navy, '#FFFFFF', C.navy],
  secondary: [C.paper, C.ink, C.line],
  soft: [C.sky, C.navy, C.sky],
  ghost: ['transparent', C.blue, 'transparent'],
  danger: [C.redBg, C.red, '#FFD6DF'],
  light: ['#FFFFFF', C.navy, '#FFFFFF'],
  glass: ['rgba(255,255,255,0.12)', '#FFFFFF', 'rgba(255,255,255,0.18)'],
};
type BtnProps = PressableProps & { title: string; variant?: BtnVariant; loading?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle>; big?: boolean; small?: boolean };
export function Button({ title, variant = 'secondary', loading, icon, style, big, small, disabled, ...p }: BtnProps) {
  const key = variant === 'pri' ? 'primary' : variant === 'default' ? 'secondary' : variant;
  const [bg, fg, border] = BTN[key];
  const h = big ? 56 : small ? 38 : 48;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }} disabled={disabled || loading} {...p}
      style={({ pressed }) => [s.btn, { height: h, borderRadius: small ? 12 : 16, paddingHorizontal: small ? 14 : 20, backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, key === 'primary' && !disabled && shadow(2), style]}>
      {loading ? <ActivityIndicator color={fg} /> : <>{icon}<Text style={[s.btnText, { color: fg, fontSize: big ? 16.5 : small ? 13.5 : 15 }]}>{title}</Text></>}
    </Pressable>
  );
}

export function IconButton({ children, onPress, label, badge, tone = 'paper' }: { children: React.ReactNode; onPress?: () => void; label: string; badge?: number; tone?: 'paper' | 'glass' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => [s.iconBtn, tone === 'glass' ? { backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)' } : shadow(1), pressed && { opacity: 0.7 }]}>
      {children}
      {badge ? <View style={s.dotBadge}><Text style={s.dotBadgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
    </Pressable>
  );
}

export function Input({ label, style, icon, right, ...p }: TextInputProps & { label?: string; icon?: React.ReactNode; right?: React.ReactNode }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label && <T v="small" style={{ fontFamily: F.semi, color: C.text }}>{label}</T>}
      <View style={[s.field, focus && s.fieldFocus, p.multiline && { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: 12 }]}>
        {icon}
        <TextInput placeholderTextColor={C.faint} {...p} onFocus={(e) => { setFocus(true); p.onFocus?.(e); }} onBlur={(e) => { setFocus(false); p.onBlur?.(e); }} style={[s.input, style]} />
        {right}
      </View>
    </View>
  );
}

/** Pill buttons to pick one option. */
export function Chips<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([k, label]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => onChange(k)} style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** iOS-style segmented control. */
export function Segmented<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string, number?])[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map(([k, label, count]) => {
        const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(k)} style={[s.segItem, on && [s.segOn, shadow(1)]]}>
            <Text style={[s.segText, on && { color: C.ink }]}>{label}</Text>
            {count ? <View style={[s.segCount, on && { backgroundColor: C.navy }]}><Text style={[s.segCountText, on && { color: '#fff' }]}>{count}</Text></View> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Display ─────────────────────────────────────────────────────────────────

type Tone = 'gray' | 'green' | 'amber' | 'red' | 'blue' | 'navy' | 'violet';
const TONES: Record<Tone, [string, string]> = {
  gray: ['#EFF1F6', C.text], green: [C.greenBg, '#0B7A47'], amber: [C.amberBg, C.amber], red: [C.redBg, C.red], blue: [C.sky, C.blue], navy: [C.navy, '#fff'], violet: [C.violetBg, C.violet],
};
export const toneColor = (t: Tone) => TONES[t];

export function Badge({ text, tone = 'gray', dot }: { text: string; tone?: Tone; dot?: boolean }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />}
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

/** Rounded square with a tinted background holding an icon. */
export function IconTile({ children, tone = 'blue', size = 40 }: { children: React.ReactNode; tone?: Tone; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: TONES[tone][0], alignItems: 'center', justifyContent: 'center' }}>{children}</View>;
}

/** Card holding rows separated by hairlines, like iOS settings. */
export function List({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = (Array.isArray(children) ? children.flat() : [children]).filter(Boolean);
  return (
    <View style={[s.card, { paddingVertical: 4 }, style]}>
      {rows.map((c, i) => <View key={i}>{i > 0 && <View style={s.sep} />}{c}</View>)}
    </View>
  );
}

export function Row({ title, sub, right, onPress, icon, chevron, danger }: { title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; icon?: React.ReactNode; chevron?: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={({ pressed }) => [s.row, pressed && { backgroundColor: C.bg }]}>
      {icon}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[s.rowTitle, danger && { color: C.red }]} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={s.rowSub} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right}
      {chevron && <ChevronRight color={C.faint} size={18} />}
    </Pressable>
  );
}

export function Stat({ icon, label, value, hint, onPress, style }: { icon?: React.ReactNode; label: string; value: string; hint?: string; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [s.card, { flex: 1, padding: 16, gap: 10 }, pressed && { opacity: 0.85 }, style]}>
      {icon}
      <View style={{ gap: 2 }}>
        <T v="number">{value}</T>
        <T v="small">{label}</T>
        {hint ? <T v="caption" color={C.faint}>{hint}</T> : null}
      </View>
    </Pressable>
  );
}

/** Thin progress bar. */
export function Progress({ value, color = C.navy, track = C.hair, height = 6 }: { value: number; color?: string; track?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 26, paddingHorizontal: 20, gap: 8 }}>
      <View style={s.emptyIcon}>{icon}</View>
      <T v="heading" style={{ textAlign: 'center', marginTop: 4 }}>{title}</T>
      {text ? <T v="small" style={{ textAlign: 'center', maxWidth: 280 }}>{text}</T> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}
export function Empty({ text }: { text: string }) {
  return <T v="small" style={{ textAlign: 'center', paddingVertical: 18 }}>{text}</T>;
}

export function Loading() {
  return <View style={{ paddingVertical: 60, alignItems: 'center' }}><ActivityIndicator color={C.navy} /></View>;
}

export function ErrorText({ text }: { text?: string | null }) {
  return text ? <View style={s.error}><Text style={s.errorText}>{text}</Text></View> : null;
}

export function Avatar({ name, size = 48, ring }: { name: string; size?: number; ring?: boolean }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, ring && { borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }]}>
      <LinearGradient colors={G.orb} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={{ color: '#fff', fontFamily: F.bold, fontSize: size * 0.36 }}>{initials || 'O'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  notice: { backgroundColor: C.navy, paddingVertical: 10, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  noticeText: { color: '#fff', fontSize: 13, lineHeight: 18, fontFamily: F.medium, flexShrink: 1 },
  card: { backgroundColor: C.paper, borderRadius: R.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, gap: 12, ...shadow(1) },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { borderRadius: R.xl, overflow: 'hidden', backgroundColor: C.navy, ...shadow(3) },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  btn: { borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: F.bold, letterSpacing: -0.1 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  dotBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.bg },
  dotBadgeText: { color: '#fff', fontSize: 10, fontFamily: F.bold },
  field: { height: 54, borderWidth: 1, borderColor: C.line, borderRadius: R.md, backgroundColor: C.paper, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldFocus: { borderColor: C.navy, boxShadow: '0px 0px 0px 4px rgba(35,66,224,0.10)' },
  input: { flex: 1, fontSize: 16, color: C.ink, fontFamily: F.medium, height: '100%', outlineStyle: 'none' } as unknown as TextStyle,
  chip: { paddingHorizontal: 15, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  chipOn: { backgroundColor: C.navy, borderColor: C.navy },
  chipText: { fontFamily: F.semi, fontSize: 14, color: C.text },
  seg: { flexDirection: 'row', backgroundColor: '#E8EBF3', borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  segOn: { backgroundColor: C.paper },
  segText: { fontFamily: F.semi, fontSize: 14, color: C.muted },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#D6DBE8', alignItems: 'center', justifyContent: 'center' },
  segCountText: { fontFamily: F.bold, fontSize: 11, color: C.text },
  badge: { borderRadius: R.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeText: { fontSize: 12, fontFamily: F.bold },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginLeft: 68 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, paddingHorizontal: 14, borderRadius: R.lg },
  rowTitle: { fontSize: 15.5, fontFamily: F.semi, color: C.ink },
  rowSub: { fontSize: 13, fontFamily: F.regular, color: C.muted, lineHeight: 18 },
  emptyIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.sky, alignItems: 'center', justifyContent: 'center' },
  error: { backgroundColor: C.redBg, borderRadius: R.md, padding: 14, borderWidth: 1, borderColor: '#FFD6DF' },
  errorText: { color: C.red, fontSize: 14, fontFamily: F.medium, lineHeight: 20 },
});
