"use client";

import { useState } from "react";
import { ListChecks, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteEmailList, type EmailContact, type EmailList } from "@/lib/email-marketing";
import { ListFormDialog } from "./list-form-dialog";

interface ListsTabProps {
  lists: EmailList[];
  contacts: EmailContact[];
  onChanged: () => void;
}

export function ListsTab({ lists, contacts, onChanged }: ListsTabProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmailList | null>(null);

  const handleDelete = async (list: EmailList) => {
    if (!confirm(`Excluir a lista "${list.name}"? Os contatos não serão removidos da base.`)) return;
    await deleteEmailList(list.id);
    onChanged();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Segmentos de contatos usados para direcionar campanhas.
        </p>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nova lista
        </Button>
      </div>

      <Card className="rounded-xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Contatos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lists.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-14">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <ListChecks className="h-8 w-8 opacity-40" />
                      <p className="text-sm">Nenhuma lista criada ainda.</p>
                      <p className="text-xs">Use listas para segmentar suas campanhas por público.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {lists.map((list) => (
                <TableRow
                  key={list.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setEditing(list);
                    setFormOpen(true);
                  }}
                >
                  <TableCell className="font-medium">{list.name}</TableCell>
                  <TableCell className="text-muted-foreground">{list.description ?? "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {list.contactCount ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(list);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ListFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        list={editing}
        contacts={contacts}
        onSaved={onChanged}
      />
    </div>
  );
}
