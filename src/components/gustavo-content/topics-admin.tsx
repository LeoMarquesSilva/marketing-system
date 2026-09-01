"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GustavoContentTopic } from "@/lib/gustavo-content/types";

export function TopicsAdmin() {
  const [topics, setTopics] = useState<GustavoContentTopic[]>([]);
  const [name, setName] = useState("");
  const [rssQuery, setRssQuery] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/gustavo-content/topics");
    if (response.ok) setTopics(await response.json());
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    setBusy(true);
    try {
      await fetch("/api/gustavo-content/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, rss_query: rssQuery }),
      });
      setName("");
      setRssQuery("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggle(topic: GustavoContentTopic) {
    await fetch(`/api/gustavo-content/topics/${topic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !topic.is_active }),
    });
    await load();
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <h3 className="text-sm font-semibold text-[#04202f]">Temas RSS</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Somente admin. Queries próprias do Gustavo — não usa os temas do carrossel.
      </p>
      <ul className="mt-3 space-y-2">
        {topics.map((topic) => (
          <li key={topic.id} className="flex items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-[#04202f]">{topic.name}</p>
              <p className="text-xs text-muted-foreground">{topic.rss_query}</p>
            </div>
            <Button size="xs" variant="outline" onClick={() => toggle(topic)}>
              {topic.is_active ? "Desativar" : "Ativar"}
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome" />
        <Input
          value={rssQuery}
          onChange={(event) => setRssQuery(event.target.value)}
          placeholder='("recuperação judicial" OR "dívida")'
        />
        <Button size="sm" onClick={create} disabled={busy || !name || !rssQuery}>
          Adicionar
        </Button>
      </div>
    </section>
  );
}
