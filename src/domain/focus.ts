import type { Session } from '@/db/types';

export interface SetPos {
  bi: number;
  ii: number;
  si: number;
}

/**
 * Ordine in cui si eseguono le serie: blocco per blocco; prima il riscaldamento,
 * poi nei superset e nei circuiti a giri (A1, B1, A2, B2…), negli esercizi singoli
 * una serie dopo l'altra.
 */
export function setOrder(session: Session): SetPos[] {
  const out: SetPos[] = [];
  session.blocks.forEach((b, bi) => {
    // il riscaldamento di ogni esercizio viene prima dei giri di lavoro
    const warmups = b.items.map((it) =>
      it.sets.findIndex((s) => s.target?.kind !== 'warmup') === -1
        ? it.sets.length
        : it.sets.findIndex((s) => s.target?.kind !== 'warmup'),
    );
    b.items.forEach((_, ii) => {
      for (let si = 0; si < warmups[ii]!; si++) out.push({ bi, ii, si });
    });
    const rounds = Math.max(0, ...b.items.map((it, ii) => it.sets.length - warmups[ii]!));
    for (let r = 0; r < rounds; r++)
      b.items.forEach((it, ii) => {
        const si = warmups[ii]! + r;
        if (si < it.sets.length) out.push({ bi, ii, si });
      });
  });
  return out;
}

/** Indice della prima serie non ancora fatta (o -1 se è tutto fatto). */
export function firstUndone(session: Session, order = setOrder(session)): number {
  return order.findIndex((p) => !session.blocks[p.bi]!.items[p.ii]!.sets[p.si]!.done);
}
