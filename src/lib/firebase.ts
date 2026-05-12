import { initializeApp, getApps } from "firebase/app";
import {
  addDoc,
  writeBatch,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "firebase/firestore";
import {
  ClassifiedImportRecord,
  Ticket,
  TicketCreateInput,
  TicketUpdateInput
} from "@/lib/types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);

const ticketsCollection = collection(db, "tickets");

const toTicket = (
  id: string,
  data: Record<string, unknown> & {
    createdAt?: { toDate: () => Date };
    updatedAt?: { toDate: () => Date };
  }
): Ticket => ({
  id,
  senderEmail: String(data.senderEmail ?? ""),
  senderName: String(data.senderName ?? ""),
  subject: String(data.subject ?? ""),
  body: String(data.body ?? ""),
  category: (data.category as Ticket["category"]) ?? "suggestions",
  priority: (data.priority as Ticket["priority"]) ?? 3,
  aiSummary: String(data.aiSummary ?? ""),
  status: (data.status as Ticket["status"]) ?? "open",
  source: (data.source as Ticket["source"]) ?? "manual",
  createdAt: data.createdAt?.toDate().toISOString() ?? new Date().toISOString(),
  updatedAt: data.updatedAt?.toDate().toISOString() ?? new Date().toISOString()
});

export const subscribeToTickets = (onChange: (tickets: Ticket[]) => void) => {
  const q = query(ticketsCollection, orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((ticketDoc) =>
      toTicket(ticketDoc.id, ticketDoc.data())
    );
    onChange(tickets);
  });
};

export const createTicket = async (
  input: TicketCreateInput & {
    category: Ticket["category"];
    priority: Ticket["priority"];
    aiSummary: string;
  }
) => {
  await addDoc(ticketsCollection, {
    senderEmail: input.senderEmail.trim(),
    senderName: input.senderName?.trim() ?? "",
    subject: input.subject.trim(),
    body: input.body.trim(),
    category: input.category,
    priority: input.priority,
    aiSummary: input.aiSummary.trim(),
    status: input.category === "handled" ? "handled" : "open",
    source: input.source,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

export const createTicketsBulk = async (records: ClassifiedImportRecord[]) => {
  if (records.length === 0) {
    return;
  }

  const batch = writeBatch(db);
  for (const record of records) {
    const newDoc = doc(ticketsCollection);
    batch.set(newDoc, {
      senderEmail: record.senderEmail.trim(),
      senderName: record.senderName.trim(),
      subject: record.subject.trim(),
      body: record.body.trim(),
      category: record.category,
      priority: record.priority,
      aiSummary: record.summary.trim(),
      status: "open",
      source: "import",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
};

export const updateTicket = async (ticketId: string, input: TicketUpdateInput) => {
  const ticketRef = doc(db, "tickets", ticketId);
  await updateDoc(ticketRef, {
    ...input,
    status: input.category === "handled" ? "handled" : input.status,
    updatedAt: serverTimestamp()
  });
};

export const deleteTicket = async (ticketId: string) => {
  const ticketRef = doc(db, "tickets", ticketId);
  await deleteDoc(ticketRef);
};
