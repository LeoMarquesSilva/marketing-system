"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Users, ListChecks, Settings, Building2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchEmailCampaigns,
  fetchEmailCompanies,
  fetchEmailContacts,
  fetchEmailLists,
  fetchEmailPeople,
  fetchEmailRdEmails,
  type EmailCampaign,
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

type EmailMarketingTabId =
  | "campanhas"
  | "contatos"
  | "empresas"
  | "listas"
  | "progresso"
  | "configuracoes";

const TABS: { id: EmailMarketingTabId; label: string; icon: React.ReactNode }[] = [
  { id: "campanhas", label: "Campanhas", icon: <Mail className="h-4 w-4" /> },
  { id: "contatos", label: "Contatos", icon: <Users className="h-4 w-4" /> },
  { id: "empresas", label: "Empresas", icon: <Building2 className="h-4 w-4" /> },
  { id: "listas", label: "Listas", icon: <ListChecks className="h-4 w-4" /> },
  { id: "progresso", label: "Progresso", icon: <TrendingUp className="h-4 w-4" /> },
  { id: "configuracoes", label: "Configurações", icon: <Settings className="h-4 w-4" /> },
];

export function EmailMarketingClient() {
  const [activeTab, setActiveTab] = useState<EmailMarketingTabId>("campanhas");
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<EmailContact[]>([]);
  const [companies, setCompanies] = useState<EmailCompany[]>([]);
  const [people, setPeople] = useState<EmailPerson[]>([]);
  const [lists, setLists] = useState<EmailList[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [rdEmails, setRdEmails] = useState<EmailRdEmail[]>([]);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, co, pe, l, cp, rd] = await Promise.all([
        fetchEmailContacts(),
        fetchEmailCompanies(),
        fetchEmailPeople(),
        fetchEmailLists(),
        fetchEmailCampaigns(),
        fetchEmailRdEmails(),
      ]);
      setContacts(c);
      setCompanies(co);
      setPeople(pe);
      setLists(l);
      setCampaigns(cp);
      setRdEmails(rd);
    } finally {
      setLoading(false);
    }
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

  const reloadCampaigns = useCallback(async () => {
    const [cp, rd] = await Promise.all([fetchEmailCampaigns(), fetchEmailRdEmails()]);
    setCampaigns(cp);
    setRdEmails(rd);
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">E-mail Marketing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Base de contatos, campanhas e newsletters — com rastreio de abertura e clique
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
            className="gap-2"
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            {tab.icon}
            {tab.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          {activeTab === "campanhas" && (
            <CampaignsTab
              campaigns={campaigns}
              rdEmails={rdEmails}
              lists={lists}
              contacts={contacts}
              onChanged={reloadCampaigns}
            />
          )}
          {activeTab === "contatos" && (
            <ContactsTab contacts={contacts} companies={companies} onChanged={reloadContacts} />
          )}
          {activeTab === "empresas" && (
            <CompaniesTab companies={companies} contacts={contacts} people={people} />
          )}
          {activeTab === "listas" && (
            <ListsTab lists={lists} contacts={contacts} onChanged={reloadLists} />
          )}
          {activeTab === "progresso" && <ProgressTab contacts={contacts} people={people} />}
          {activeTab === "configuracoes" && <SettingsTab />}
        </>
      )}
    </div>
  );
}
