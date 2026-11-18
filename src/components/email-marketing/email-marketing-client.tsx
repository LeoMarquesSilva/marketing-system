"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAllEmailCampaignStats,
  fetchEmailCampaigns,
  fetchEmailCompanies,
  fetchEmailContacts,
  fetchEmailLists,
  fetchEmailPeople,
  fetchEmailRdEmails,
  type EmailCampaign,
  type EmailCampaignStats,
  type EmailCompany,
  type EmailContact,
  type EmailList,
  type EmailPerson,
  type EmailRdEmail,
} from "@/lib/email-marketing";
import { CampaignsTab } from "./campaigns-tab";
import { ContactsTab } from "./contacts-tab";
import { CompaniesTab } from "./companies-tab";
import { ListsTab } from "./lists-tab";
import { SettingsTab } from "./settings-tab";
import { ProgressTab } from "./progress-tab";
import EmailMarketingLoading from "@/app/email-marketing/loading";

export type EmailMarketingTabId =
  | "campanhas"
  | "contatos"
  | "empresas"
  | "listas"
  | "progresso"
  | "configuracoes";

/** O que cada aba precisa carregar (as abas agora são páginas do cabeçalho). */
const NEEDS: Record<EmailMarketingTabId, { contacts?: boolean; companies?: boolean; people?: boolean; lists?: boolean; campaigns?: boolean }> = {
  campanhas: { contacts: true, lists: true, campaigns: true },
  contatos: { contacts: true, companies: true },
  empresas: { contacts: true, companies: true, people: true },
  listas: { contacts: true, lists: true, campaigns: true },
  progresso: { contacts: true, people: true },
  configuracoes: {},
};

export function EmailMarketingClient({ tab }: { tab: EmailMarketingTabId }) {
  const needs = NEEDS[tab];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [companies, setCompanies] = useState<EmailCompany[]>([]);
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [campaignStats, setCampaignStats] = useState<Record<string, EmailCampaignStats>>({});
  const [rdEmails, setRdEmails] = useState<EmailRdEmail[]>([]);

  const reloadCampaigns = useCallback(async () => {
    const [cp, stats, rd] = await Promise.all([
      fetchEmailCampaigns(),
      fetchAllEmailCampaignStats(),
      fetchEmailRdEmails(),
    ]);
    setCampaigns(cp);
    setCampaignStats(stats);
    setRdEmails(rd);
  }, []);

  const reloadContacts = useCallback(async () => {
    const [c, co, pe] = await Promise.all([fetchEmailContacts(), fetchEmailCompanies(), fetchEmailPeople()]);
    setContacts(c);
    setCompanies(co);
    setPeople(pe);
  }, []);

  const reloadLists = useCallback(async () => {
    setLists(await fetchEmailLists());
  }, []);

  // Cada aba é uma página própria: o componente monta de novo ao trocar de aba.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      needs.contacts ? fetchEmailContacts().then((v) => !cancelled && setContacts(v)) : null,
      needs.companies ? fetchEmailCompanies().then((v) => !cancelled && setCompanies(v)) : null,
      needs.people ? fetchEmailPeople().then((v) => !cancelled && setPeople(v)) : null,
      needs.lists ? fetchEmailLists().then((v) => !cancelled && setLists(v)) : null,
      needs.campaigns
        ? Promise.all([fetchEmailCampaigns(), fetchAllEmailCampaignStats(), fetchEmailRdEmails()]).then(([cp, st, rd]) => {
            if (cancelled) return;
            setCampaigns(cp);
            setCampaignStats(st);
            setRdEmails(rd);
          })
        : null,
    ])
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Erro ao carregar os dados."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [needs]);

  if (loading) return <EmailMarketingLoading />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
        {error}
      </div>
    );
  }

  switch (tab) {
    case "campanhas":
      return (
        <CampaignsTab
          campaigns={campaigns}
          stats={campaignStats}
          rdEmails={rdEmails}
          lists={lists}
          contacts={contacts}
          onChanged={reloadCampaigns}
        />
      );
    case "contatos":
      return <ContactsTab contacts={contacts} companies={companies} onChanged={reloadContacts} />;
    case "empresas":
      return <CompaniesTab companies={companies} contacts={contacts} people={people} />;
    case "listas":
      return <ListsTab lists={lists} contacts={contacts} campaigns={campaigns} onChanged={reloadLists} />;
    case "progresso":
      return <ProgressTab contacts={contacts} people={people} />;
    case "configuracoes":
      return <SettingsTab />;
  }
}
