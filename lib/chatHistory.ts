import * as admin from "firebase-admin";
import { getAdminDb } from "./firebaseAdmin";

export type StoredChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export const MAX_CONTEXT_MESSAGES = 40;
export const MAX_STORED_MESSAGES = 200;

function chatDocRef(userId: string) {
  return getAdminDb()
    .collection("users")
    .doc(userId)
    .collection("assistant")
    .doc("chat");
}

function isValidMessage(value: unknown): value is StoredChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as StoredChatMessage;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export async function getChatMessages(userId: string): Promise<StoredChatMessage[]> {
  const doc = await chatDocRef(userId).get();
  if (!doc.exists) return [];

  const messages = doc.data()?.messages;
  if (!Array.isArray(messages)) return [];

  return messages.filter(isValidMessage);
}

export async function saveChatMessages(
  userId: string,
  messages: StoredChatMessage[]
): Promise<StoredChatMessage[]> {
  const trimmed = messages.slice(-MAX_STORED_MESSAGES);

  await chatDocRef(userId).set(
    {
      messages: trimmed,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return trimmed;
}

export function toLlmMessages(messages: StoredChatMessage[]) {
  return messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map(({ role, content }) => ({ role, content }));
}
