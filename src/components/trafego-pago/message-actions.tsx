"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Copy,
  Flag,
  MoreVertical,
  Pin,
  Reply,
  SmilePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

const QUICK_REACTIONS = ["👍", "❤️", "🙏", "👀", "✅", "❗", "🔥"];

interface MessageActionsProps {
  canReply: boolean;
  fromMe?: boolean;
  messageText?: string;
  onReply: () => void;
  onPin: () => void;
  onToggleHot: () => void;
  onReaction: (emoji: string) => void;
}

export function MessageActions({
  canReply,
  fromMe = false,
  messageText,
  onReply,
  onPin,
  onToggleHot,
  onReaction,
}: MessageActionsProps) {
  const [openReactions, setOpenReactions] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyMessage = async () => {
    const text = messageText?.trim();
    if (!text) return;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div
      className={cn(
        "absolute -top-9 z-30 flex max-w-[min(280px,calc(100vw-3rem))] items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100 group-focus-within/msg:opacity-100",
        (openMenu || openReactions) && "opacity-100",
        fromMe ? "right-0 justify-end" : "left-0 justify-start"
      )}
    >
      <AnimatePresence>
        {openReactions && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            className={cn(
              "absolute bottom-full mb-2 flex max-w-[min(300px,calc(100vw-3rem))] gap-1 overflow-x-auto rounded-full border bg-white p-1.5 shadow-lg dark:bg-card",
              fromMe ? "right-0" : "left-0"
            )}
          >
            {QUICK_REACTIONS.map((emoji, index) => (
              <motion.button
                key={emoji}
                type="button"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.025, type: "spring", stiffness: 450, damping: 22 }}
                whileHover={{ scale: 1.25 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  onReaction(emoji);
                  setOpenReactions(false);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-muted"
                aria-label={`Reagir com ${emoji}`}
              >
                {emoji}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingAction
        label="Reagir"
        onClick={() => setOpenReactions((value) => !value)}
        icon={<SmilePlus className="h-3.5 w-3.5" />}
      />
      {canReply && (
        <FloatingAction
          label="Responder"
          onClick={onReply}
          icon={<Reply className="h-3.5 w-3.5" />}
        />
      )}
      <FloatingAction
        label="Fixar"
        onClick={onPin}
        icon={<Pin className="h-3.5 w-3.5" />}
        className="hidden sm:flex"
      />

      <div className="relative">
        <FloatingAction
          label="Mais opções"
          onClick={() => setOpenMenu((value) => !value)}
          icon={<MoreVertical className="h-3.5 w-3.5" />}
        />
        <AnimatePresence>
          {openMenu && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                className={cn(
                  "absolute top-9 hidden max-h-[min(420px,calc(100dvh-12rem))] w-64 overflow-y-auto rounded-lg border bg-white p-1 text-sm shadow-2xl sm:block dark:bg-card",
                  fromMe ? "right-0" : "left-0"
                )}
              >
                <MessageMenuItems
                  canReply={canReply}
                  onReply={onReply}
                  onPin={onPin}
                  onToggleHot={onToggleHot}
                  onCopy={copyMessage}
                  onOpenReactions={() => setOpenReactions(true)}
                  onClose={() => setOpenMenu(false)}
                  canCopy={Boolean(messageText?.trim())}
                  copied={copied}
                />
              </motion.div>

              <MobileMessageMenuSheet
                canReply={canReply}
                onReply={onReply}
                onPin={onPin}
                onToggleHot={onToggleHot}
                onCopy={copyMessage}
                onOpenReactions={() => setOpenReactions(true)}
                onClose={() => setOpenMenu(false)}
                canCopy={Boolean(messageText?.trim())}
                copied={copied}
              />
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MobileMessageMenuSheet({
  canReply,
  onReply,
  onPin,
  onToggleHot,
  onCopy,
  onOpenReactions,
  onClose,
  canCopy,
  copied,
}: {
  canReply: boolean;
  onReply: () => void;
  onPin: () => void;
  onToggleHot: () => void;
  onCopy: () => void;
  onOpenReactions: () => void;
  onClose: () => void;
  canCopy: boolean;
  copied: boolean;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[2px] sm:hidden"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 28, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="fixed inset-x-3 bottom-3 z-50 max-h-[72dvh] overflow-hidden rounded-lg border bg-white p-2 shadow-2xl sm:hidden dark:bg-card"
      >
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/25" />
        <div className="mb-2 px-2">
          <p className="text-sm font-semibold text-foreground">Ações da mensagem</p>
          <p className="text-xs text-muted-foreground">Escolha uma ação para este atendimento.</p>
        </div>
        <div className="max-h-[58dvh] overflow-y-auto pb-1">
          <MessageMenuItems
            canReply={canReply}
            onReply={onReply}
            onPin={onPin}
            onToggleHot={onToggleHot}
            onCopy={onCopy}
            onOpenReactions={onOpenReactions}
            onClose={onClose}
            canCopy={canCopy}
            copied={copied}
            roomy
          />
        </div>
      </motion.div>
    </>,
    document.body
  );
}

function FloatingAction({
  label,
  icon,
  onClick,
  className,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:text-foreground dark:bg-card",
        className
      )}
    >
      {icon}
    </button>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
  roomy = false,
}: {
  icon: React.ReactElement;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  roomy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-muted disabled:opacity-40",
        roomy && "py-3 text-sm",
        danger && "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
      )}
    >
      <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{icon}</span>
      {label}
    </button>
  );
}

function MessageMenuItems({
  canReply,
  onReply,
  onPin,
  onToggleHot,
  onCopy,
  onOpenReactions,
  onClose,
  canCopy,
  copied,
  roomy = false,
}: {
  canReply: boolean;
  onReply: () => void;
  onPin: () => void;
  onToggleHot: () => void;
  onCopy: () => void;
  onOpenReactions: () => void;
  onClose: () => void;
  canCopy: boolean;
  copied: boolean;
  roomy?: boolean;
}) {
  const runAction = async (callback?: () => void | Promise<void>) => {
    await callback?.();
    onClose();
  };

  return (
    <div className={cn("grid gap-0.5", roomy && "gap-1")}>
      <MenuItem
        icon={<Reply />}
        label="Responder"
        onClick={() => runAction(onReply)}
        disabled={!canReply}
        roomy={roomy}
      />
      <MenuItem
        icon={<SmilePlus />}
        label="Reagir"
        onClick={() => {
          onOpenReactions();
          onClose();
        }}
        roomy={roomy}
      />
      <MenuItem icon={<Pin />} label="Fixar mensagem" onClick={() => runAction(onPin)} roomy={roomy} />
      <MenuItem
        icon={<Flag />}
        label="Marcar como oportunidade"
        onClick={() => runAction(onToggleHot)}
        roomy={roomy}
      />
      <MenuItem
        icon={<Copy />}
        label={copied ? "Mensagem copiada" : "Copiar mensagem"}
        onClick={() => runAction(onCopy)}
        disabled={!canCopy}
        roomy={roomy}
      />
    </div>
  );
}
