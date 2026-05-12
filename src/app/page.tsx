"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Plus, Upload } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { Sidebar } from "@/components/Sidebar";
import { TicketGrid } from "@/components/TicketGrid";
import { deleteTicket, updateTicket } from "@/lib/firebase";
import { Ticket, TicketCategory } from "@/lib/types";
import { useTickets } from "@/hooks/useTickets";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ImportModal } from "@/components/ImportModal";
import { NewTicketModal } from "@/components/NewTicketModal";
import { EditTicketModal } from "@/components/EditTicketModal";

export default function DashboardPage() {
  const [activeCategory, setActiveCategory] = useState<TicketCategory | "all">(
    "all"
  );
  const [searchValue, setSearchValue] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [visibleCount, setVisibleCount] = useState(60);
  const debouncedSearch = useDebouncedValue(searchValue, 250);

  const { filteredTickets, counts, isLoading } = useTickets(
    activeCategory,
    debouncedSearch
  );

  const totalOpen = useMemo(
    () => counts.all - counts.handled,
    [counts.all, counts.handled]
  );

  const onMarkHandled = async (ticketId: string) => {
    await updateTicket(ticketId, { category: "handled", status: "handled" });
  };

  const onDelete = async (ticketId: string) => {
    if (!window.confirm("למחוק את הפנייה לצמיתות?")) {
      return;
    }
    await deleteTicket(ticketId);
  };

  useEffect(() => {
    setVisibleCount(60);
  }, [activeCategory, debouncedSearch]);

  const visibleTickets = useMemo(
    () => filteredTickets.slice(0, visibleCount),
    [filteredTickets, visibleCount]
  );
  const hasMore = filteredTickets.length > visibleCount;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <section className="lux-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="inline-flex items-center gap-3">
            <span className="rounded-2xl border border-outline bg-white p-1 shadow-soft">
              <Image
                src="/jusic-logo.svg"
                width={36}
                height={36}
                alt="Jusic logo"
                className="rounded-xl"
              />
            </span>
            <div>
              <h1 className="text-xl font-semibold">Jusic Ticketing CRM</h1>
              <p className="text-sm text-on-surface-variant">
                מחלקת שירות ו-CRM חכם
              </p>
              <p className="text-xs text-on-surface-variant">
                {totalOpen} פניות פתוחות מתוך {counts.all}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="lux-button"
            >
              <Upload className="ml-1 size-4" />
              יבוא CSV/JSON
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="lux-button-primary"
            >
              <Plus className="ml-1 size-4" />
              פנייה חדשה
            </button>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[280px,1fr]">
          <Sidebar
            activeCategory={activeCategory}
            counts={counts}
            onSelectCategory={setActiveCategory}
          />

          <div className="space-y-4">
            <SearchBar value={searchValue} onChange={setSearchValue} />
            <TicketGrid
              tickets={visibleTickets}
              onMarkHandled={onMarkHandled}
              onEdit={setEditingTicket}
              onDelete={onDelete}
              isLoading={isLoading}
            />
            {hasMore ? (
              <div className="flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 60)}
                  className="lux-button"
                >
                  טען עוד (נשארו {filteredTickets.length - visibleCount})
                </button>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
      <NewTicketModal isOpen={showNewModal} onClose={() => setShowNewModal(false)} />
      <EditTicketModal
        ticket={editingTicket}
        onClose={() => setEditingTicket(null)}
      />
    </main>
  );
}
