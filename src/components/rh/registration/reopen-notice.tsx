"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check, Flag } from "lucide-react";
import styles from "@/components/rh/registration/ficha-publica.module.css";
import type { RegistrationReopenMarks } from "@/components/rh/registration/registration-form-fields";
import { diffAnswers, firstField, flaggedItems, untouchedFields } from "@/lib/rh/registration/history";
import type { RegistrationAnswers, RegistrationField } from "@/lib/rh/registration/types";

/**
 * Ficha devolvida: o que a RH marcou e, disso, o que a pessoa ainda não mexeu
 * desde que abriu (vira "ajustado" assim que muda o valor).
 */
export function useReopenMarks(
  flagged: readonly RegistrationField[],
  original: RegistrationAnswers | null,
  current: RegistrationAnswers | null
): { marks: RegistrationReopenMarks | null; pending: RegistrationField[] } {
  return useMemo(() => {
    if (flagged.length === 0 || !original || !current) return { marks: null, pending: [] };
    const pending = untouchedFields(
      flagged,
      diffAnswers(original, current).map((change) => change.field)
    );
    const pendingSet = new Set(pending);
    return {
      marks: { flagged: new Set(flagged), adjusted: new Set(flagged.filter((field) => !pendingSet.has(field))) },
      pending,
    };
  }, [flagged, original, current]);
}

/** Ao abrir a ficha devolvida, leva direto ao primeiro campo marcado. */
export function useJumpToFirstFlagged(
  flagged: readonly RegistrationField[],
  ready: boolean,
  jump: (field: RegistrationField) => void
) {
  // Uma vez por pedido (recarregar a ficha traz uma lista nova).
  const jumpedFor = useRef<readonly RegistrationField[] | null>(null);
  useEffect(() => {
    if (jumpedFor.current === flagged || !ready || flagged.length === 0) return;
    const first = firstField(flagged);
    if (!first) return;
    // Espera o formulário montar (e as listas de cidade/banco) antes de rolar.
    const timer = window.setTimeout(() => {
      jumpedFor.current = flagged;
      jump(first);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [flagged, ready, jump]);
}

export function ReopenNotice({
  note,
  flagged,
  pending,
  onJump,
}: {
  note: string | null;
  flagged: readonly RegistrationField[];
  pending: readonly RegistrationField[];
  onJump: (field: RegistrationField) => void;
}) {
  if (!note && flagged.length === 0) return null;
  const pendingSet = new Set(pending);
  return (
    <section className={styles.reopen} role="note">
      <p className={styles.reopenLabel}>Pessoas e Cultura pediu um ajuste</p>
      {note && <p className={styles.reopenText}>{note}</p>}
      {flagged.length > 0 && (
        <ul className={styles.reopenFields} aria-label="Campos para ajustar">
          {flaggedItems(flagged).map((item) => {
            const done = !item.fields.some((field) => pendingSet.has(field));
            return (
              <li key={item.field}>
                <button
                  type="button"
                  className={styles.reopenField}
                  data-done={done || undefined}
                  onClick={() => onJump(item.field)}
                >
                  {done ? <Check aria-hidden /> : <Flag aria-hidden />}
                  {item.label}
                  {done && <span className="sr-only"> (ajustado)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Aviso no envio quando algum campo pedido continua igual (não bloqueia). */
export function UntouchedWarning({ pending, className }: { pending: readonly RegistrationField[]; className?: string }) {
  if (pending.length === 0) return null;
  const labels = flaggedItems(pending).map((item) => item.label);
  return (
    <p className={className ?? styles.finishNote}>
      Você ainda não mexeu em {labels.join(", ")}, que Pessoas e Cultura pediu para ajustar. Se já estiver certo, pode
      enviar assim mesmo.
    </p>
  );
}
