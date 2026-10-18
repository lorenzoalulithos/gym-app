import type { Session } from '@/db/types';

export interface SetPos {
  bi: number;
  ii: number;
  si: number;
}

/**
 * Ordine in cui si eseguono le serie: blocco per blocco; nei superset e nei circuiti
 * a giri (A1, B1, A2, B2…), negli esercizi singoli una serie dopo l'altra.
 */
export function setOrder(session: Session): SetPos[] {
  const out: SetPos[] = [];
  session.blocks.forEach((b, bi) => {
    const rounds = Math.max(0, ...b.items.map((i) => i.sets.length));
    for (let si = 0; si < rounds; si++)
      b.items.forEach((it, ii) => {
        if (si < it.sets.length) out.push({ bi, ii, si });
      });
  });
  return out;
}

/** Indice della prima serie non ancora fatta (o -1 se è tutto fatto). */
export function firstUndone(session: Session, order = setOrder(session)): number {
  return order.findIndex((p) => !session.blocks[p.bi]!.items[p.ii]!.sets[p.si]!.done);
}
