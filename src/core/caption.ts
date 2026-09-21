/**
 * キャプションの組版。
 *
 * スタイルの `lines` は「どの項目をどの順で、どの区切りで」しか言わない。
 * 実際の文字列・幅・折り返し・縮小・切り詰めをここで決める。
 *
 * 守ること:
 * - **「（不明）」のような文字列は絶対に焼き込まない。** 値が無ければ詰める。
 * - はみ出したら**自動で**はしごを降りる。ダイアログは出さない。
 * - 降りた段は warnings に残す。黙って縮めない。
 */
import { advanceFor, ascentFor, descentFor, type TextMeasurer } from './ports';
import type { FontRef } from './scene/ops';
import type { SceneWarning } from './scene/scene';
import { SEPARATORS, SIZE_LU, TRACKING_EM } from './styles/tokens';
import type {
  Align,
  CaptionLineSpec,
  FieldId,
  SettingGate,
  SizeId,
  StyleDef,
  TrackingId,
} from './styles/types';

export type Facts = Readonly<Partial<Record<FieldId, string>>>;
export type Gates = Readonly<Record<SettingGate, boolean>>;

export interface CaptionInput {
  readonly facts: Facts;
  readonly gates: Gates;
  readonly size: SizeId;
  readonly tracking: TrackingId;
  readonly align: Align;
  readonly family: string;
  /** 地の太さ。Bold の書体を選んでいればこれが 700 になる */
  readonly weight: 400 | 700;
  /** その書体が Bold を持っているか。和文サブセットは Regular だけ（§4.7） */
  readonly hasBold: boolean;
}

export interface TypesetLine {
  readonly id: string;
  readonly text: string;
  readonly font: FontRef;
  readonly sizeLu: number;
  readonly letterSpacingLu: number;
  readonly widthLu: number;
  readonly ascent: number;
  readonly descent: number;
  readonly lineHeight: number;
  readonly align: Align;
  readonly emphasis: 'normal' | 'bold' | 'muted';
}

export interface TypesetResult {
  readonly lines: readonly TypesetLine[];
  readonly heightLu: number;
  readonly warnings: readonly SceneWarning[];
}

/** 縮小の下限。これ以上小さくすると読めなくなるので、代わりに項目を落とす */
const MIN_SHRINK = 0.82;
const SHRINK_STEP = 0.04;

const chars = (s: string): number => [...s].length;

/** 「SIGMA 18-50mm F2.8 DC DN | Contemporary 021」の縦棒以降を落とす */
const stripAfterPipe = (s: string): string => {
  const i = s.indexOf('|');
  return i < 0 ? s : s.slice(0, i).trimEnd();
};

interface Part {
  readonly field: FieldId | null;
  readonly text: string;
}

function collectParts(spec: CaptionLineSpec, input: CaptionInput): Part[] {
  const out: Part[] = [];
  for (const tok of spec.fields) {
    if (tok.t === 'literal') {
      if (tok.text) out.push({ field: null, text: tok.text });
      continue;
    }
    if (tok.gate !== undefined && !input.gates[tok.gate]) continue;
    const v = input.facts[tok.id];
    if (v === undefined || v.trim() === '') continue;
    out.push({ field: tok.id, text: v.trim() });
  }
  return out;
}

export function typesetCaption(
  def: StyleDef,
  input: CaptionInput,
  boxWidthLu: number,
  measurer: TextMeasurer,
): TypesetResult {
  const lines: TypesetLine[] = [];
  const warnings: SceneWarning[] = [];
  const baseSize = SIZE_LU[input.size] * def.typeScale;
  const trackEm = TRACKING_EM[input.tracking];

  def.caption.lines.forEach((spec, index) => {
    const parts = collectParts(spec, input);
    if (parts.length === 0) return; // 空の行は行ごと省く

    // 地がすでに Bold なら、強調しても 700 のまま（それ以上は無い）
    const weight: 400 | 700 =
      spec.emphasis === 'bold' && input.hasBold ? 700 : input.weight;
    const font: FontRef = { family: input.family, weight };
    const sep = SEPARATORS[spec.separator];
    const nominal = baseSize * spec.relSize;
    const metricsOf = (text: string): { w: (s: number) => number } => {
      const m = measurer.measure(text, font);
      return { w: (s: number) => advanceFor(m, s, s * trackEm, chars(text)) };
    };
    const maxWrap = Math.max(1, spec.maxWrap ?? 1);
    const align = spec.alignOverride ?? input.align;

    const emit = (text: string, sizeLu: number): void => {
      const m = measurer.measure(text, font);
      lines.push({
        id: `${spec.id}-${lines.length}`,
        text,
        font,
        sizeLu,
        letterSpacingLu: sizeLu * trackEm,
        widthLu: advanceFor(m, sizeLu, sizeLu * trackEm, chars(text)),
        ascent: ascentFor(m, sizeLu),
        descent: descentFor(m, sizeLu),
        lineHeight: sizeLu * spec.leading,
        align,
        emphasis: spec.emphasis,
      });
    };

    /* 段0: そのまま入るか */
    let working = parts.slice();
    let text = working.map((p) => p.text).join(sep);
    if (metricsOf(text).w(nominal) <= boxWidthLu) {
      emit(text, nominal);
      return;
    }

    /* 段1: レンズ名の縦棒以降を落とす */
    const stripped = working.map((p) =>
      p.field === 'lens' && p.text.includes('|') ? { ...p, text: stripAfterPipe(p.text) } : p,
    );
    if (stripped.some((p, i) => p.text !== working[i]?.text)) {
      working = stripped;
      text = working.map((p) => p.text).join(sep);
      if (metricsOf(text).w(nominal) <= boxWidthLu) {
        warnings.push({ kind: 'caption-degraded', line: index, field: 'lens', step: 'strip-after-pipe' });
        emit(text, nominal);
        return;
      }
    }

    /* 段2: 折り返しが許されているなら折る */
    if (maxWrap > 1) {
      const wrapped = wrap(text, nominal, boxWidthLu, metricsOf);
      if (wrapped !== null && wrapped.length <= maxWrap) {
        if (wrapped.length > 1) {
          warnings.push({ kind: 'caption-wrapped', line: index, extraLines: wrapped.length - 1 });
        }
        for (const w of wrapped) emit(w, nominal);
        return;
      }
    }

    /* 段3: 縮める */
    for (let f = 1 - SHRINK_STEP; f >= MIN_SHRINK; f -= SHRINK_STEP) {
      const s = nominal * f;
      if (maxWrap > 1) {
        const wrapped = wrap(text, s, boxWidthLu, metricsOf);
        if (wrapped !== null && wrapped.length <= maxWrap) {
          warnings.push({ kind: 'caption-shrunk', line: index, factor: Number(f.toFixed(2)) });
          for (const w of wrapped) emit(w, s);
          return;
        }
        continue;
      }
      if (metricsOf(text).w(s) <= boxWidthLu) {
        warnings.push({ kind: 'caption-shrunk', line: index, factor: Number(f.toFixed(2)) });
        emit(text, s);
        return;
      }
    }

    /* 段4: 右から項目を落とす */
    const floor = nominal * MIN_SHRINK;
    while (working.length > 1) {
      const dropped = working[working.length - 1];
      working = working.slice(0, -1);
      text = working.map((p) => p.text).join(sep);
      if (dropped?.field) {
        warnings.push({ kind: 'caption-degraded', line: index, field: dropped.field, step: 'drop' });
      }
      if (metricsOf(text).w(floor) <= boxWidthLu) {
        emit(text, floor);
        return;
      }
    }

    /* 段5: 最後の1項目も入らない。切り詰める */
    const only = working[0];
    if (!only) return;
    const cut = ellipsize(only.text, floor, boxWidthLu, metricsOf);
    if (cut !== only.text && only.field) {
      warnings.push({ kind: 'caption-truncated', line: index, field: only.field });
    }
    emit(cut, floor);
  });

  const heightLu = lines.reduce((a, l) => a + l.lineHeight, 0);
  return { lines, heightLu, warnings };
}

/**
 * 空白で貪欲に折る。空白の無い和文は1文字ずつ折る。
 * 入らない単語が1つでもあれば null（＝折っても解決しない）。
 */
function wrap(
  text: string,
  sizeLu: number,
  boxWidthLu: number,
  metricsOf: (t: string) => { w: (s: number) => number },
): string[] | null {
  const fits = (t: string): boolean => metricsOf(t).w(sizeLu) <= boxWidthLu;
  if (fits(text)) return [text];

  const words = text.split(' ').filter((w) => w !== '');
  const atoms: string[] = [];
  for (const w of words) {
    if (fits(w)) {
      atoms.push(w);
      continue;
    }
    // 空白で切れない塊（和文・長いレンズ名）は1文字ずつに割る
    let buf = '';
    for (const ch of w) {
      if (buf !== '' && !fits(buf + ch)) {
        atoms.push(buf);
        buf = ch;
      } else {
        buf += ch;
      }
    }
    if (buf !== '') atoms.push(buf);
    if (!fits(atoms[atoms.length - 1] ?? '')) return null;
  }

  const out: string[] = [];
  let line = '';
  for (const a of atoms) {
    const joiner = line === '' ? '' : ' ';
    const next = line + joiner + a;
    if (line !== '' && !fits(next)) {
      out.push(line);
      line = a;
    } else {
      line = next;
    }
  }
  if (line !== '') out.push(line);
  return out.length > 0 ? out : null;
}

function ellipsize(
  text: string,
  sizeLu: number,
  boxWidthLu: number,
  metricsOf: (t: string) => { w: (s: number) => number },
): string {
  const cp = [...text];
  if (metricsOf(text).w(sizeLu) <= boxWidthLu) return text;
  for (let n = cp.length - 1; n > 0; n--) {
    const t = `${cp.slice(0, n).join('')}…`;
    if (metricsOf(t).w(sizeLu) <= boxWidthLu) return t;
  }
  return '…';
}
