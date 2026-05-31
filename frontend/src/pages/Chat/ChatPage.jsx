import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { BackButton } from "../../components/Layout/BackButton";
import { Button } from "../../components/UI/Button";
import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { useToast } from "../../components/UI/ToastProvider";
import { fetchAdById } from "../../shared/api/ads";
import { ApiError, apiRequest } from "../../shared/api/client";
import {
  createConversationByListing,
  fetchConversationMessages,
  fetchConversations,
  markConversationRead,
} from "../../shared/api/chat";
import { createChatSocket } from "../../shared/chatWebSocket";
import "./chat.css";

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getFullName(user) {
  if (!user) {
    return "Пользователь";
  }
  return `${user.name} ${user.last_name}`.trim() || "Пользователь";
}

function mergeConversation(list, conversation) {
  if (!conversation?.id) {
    return list;
  }
  const withoutDuplicate = list.filter((item) => item.id !== conversation.id);
  return [conversation, ...withoutDuplicate];
}

export function ChatPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const listingIdFromQuery = Number(searchParams.get("listingId") || "");
  const conversationIdFromQuery = Number(searchParams.get("conversationId") || "");

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [listingContext, setListingContext] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSocketReady, setIsSocketReady] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const activeConversation = selectedConversation;

  const breadcrumbs = useMemo(() => {
    const items = [{ label: "Каталог", to: "/" }];
    const listingId = activeConversation?.listing_id || listingContext?.id || (listingIdFromQuery > 0 ? listingIdFromQuery : null);
    const listingTitle =
      activeConversation?.listing_title || listingContext?.title || (listingId ? "Объявление" : null);

    if (listingId && listingTitle) {
      items.push({ label: listingTitle, to: `/ads/${listingId}` });
      items.push({ label: "Чат" });
      return items;
    }

    items.push({ label: "Чаты" });
    return items;
  }, [activeConversation, listingContext, listingIdFromQuery]);

  const selectConversation = useCallback(
    (conversationId, { replaceListingQuery = true } = {}) => {
      if (!conversationId) {
        return;
      }
      setSelectedConversationId(conversationId);
      if (replaceListingQuery) {
        setSearchParams({ conversationId: String(conversationId) }, { replace: true });
      }
    },
    [setSearchParams],
  );

  const loadConversations = useCallback(async () => {
    try {
      const payload = await fetchConversations();
      const nextConversations = payload?.items ?? [];
      setConversations((prev) => {
        const merged = [...nextConversations];
        for (const item of prev) {
          if (!merged.some((conversation) => conversation.id === item.id)) {
            merged.push(item);
          }
        }
        return merged.sort(
          (left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
        );
      });
      setError("");
      setSelectedConversationId((prev) => {
        const preferredId =
          (Number.isInteger(conversationIdFromQuery) && conversationIdFromQuery > 0
            ? conversationIdFromQuery
            : null) || prev;
        if (preferredId && nextConversations.some((item) => item.id === preferredId)) {
          return preferredId;
        }
        if (preferredId) {
          return preferredId;
        }
        return nextConversations[0]?.id ?? null;
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить чаты", { type: "error" });
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить чаты");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [conversationIdFromQuery, navigate]);

  const loadMessages = useCallback(
    async (conversationId) => {
      if (!conversationId) {
        setMessages([]);
        return;
      }
      setIsLoadingMessages(true);
      try {
        const payload = await fetchConversationMessages(conversationId);
        setMessages(payload?.items ?? []);
        setError("");
        await markConversationRead(conversationId);
      } catch (requestError) {
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        showToast(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить сообщения", { type: "error" });
        setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить сообщения");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    let mounted = true;
    const listingId =
      activeConversation?.listing_id ||
      (Number.isInteger(listingIdFromQuery) && listingIdFromQuery > 0 ? listingIdFromQuery : null);

    if (!listingId) {
      setListingContext(null);
      return () => {
        mounted = false;
      };
    }

    if (activeConversation?.listing_id === listingId && activeConversation?.listing_title) {
      setListingContext({ id: activeConversation.listing_id, title: activeConversation.listing_title });
      return () => {
        mounted = false;
      };
    }

    async function loadListingContext() {
      try {
        const ad = await fetchAdById(listingId);
        if (!mounted) {
          return;
        }
        setListingContext({ id: ad.id, title: ad.title });
      } catch {
        if (!mounted) {
          return;
        }
        setListingContext({ id: listingId, title: "Объявление" });
      }
    }

    loadListingContext();
    return () => {
      mounted = false;
    };
  }, [activeConversation, listingIdFromQuery]);

  useEffect(() => {
    let mounted = true;

    async function loadCurrentUser() {
      try {
        const me = await apiRequest("/auth/me");
        if (mounted) {
          setCurrentUserId(me?.id ?? null);
        }
      } catch {
        if (mounted) {
          setCurrentUserId(null);
        }
      }
    }

    loadCurrentUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (Number.isInteger(conversationIdFromQuery) && conversationIdFromQuery > 0) {
      setSelectedConversationId(conversationIdFromQuery);
    }
  }, [conversationIdFromQuery]);

  useEffect(() => {
    let mounted = true;

    async function openListingChat() {
      if (!Number.isInteger(listingIdFromQuery) || listingIdFromQuery <= 0) {
        return;
      }

      try {
        const conversation = await createConversationByListing(listingIdFromQuery);
        if (!mounted) {
          return;
        }
        setConversations((prev) => mergeConversation(prev, conversation));
        selectConversation(conversation.id);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 404) {
          showToast(requestError.message || "По этому объявлению пока нет переписки", { type: "info" });
          setError(requestError.message || "По этому объявлению пока нет переписки");
        } else {
          showToast(requestError instanceof ApiError ? requestError.message : "Не удалось открыть чат", { type: "error" });
          setError(requestError instanceof ApiError ? requestError.message : "Не удалось открыть чат");
        }
      }
    }

    openListingChat();
    return () => {
      mounted = false;
    };
  }, [listingIdFromQuery, navigate, selectConversation]);

  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

  const appendMessage = useCallback((message) => {
    if (!message?.id) {
      return;
    }
    setMessages((prev) => {
      if (prev.some((item) => item.id === message.id)) {
        return prev;
      }
      return [...prev, message];
    });
    setConversations((prev) =>
      prev
        .map((conversation) =>
          conversation.id === message.conversation_id
            ? {
                ...conversation,
                last_message_text: message.text,
                last_message_at: message.created_at,
                last_message_sender_id: message.sender_id,
                updated_at: message.created_at,
              }
            : conversation,
        )
        .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()),
    );
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      socketRef.current?.close();
      socketRef.current = null;
      setIsSocketReady(false);
      return undefined;
    }

    setIsSocketReady(false);
    const socket = createChatSocket(selectedConversationId, {
      onOpen: () => {
        setIsSocketReady(true);
        setError("");
      },
      onClose: () => {
        setIsSocketReady(false);
      },
      onError: (message) => {
        setError(message);
      },
      onMessage: (message) => {
        appendMessage(message);
        if (message.sender_id !== currentUserId) {
          markConversationRead(selectedConversationId).catch(() => undefined);
        }
      },
    });

    socketRef.current = socket;
    return () => {
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setIsSocketReady(false);
    };
  }, [appendMessage, currentUserId, selectedConversationId]);

  async function handleSendMessage(event) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedConversationId) {
      return;
    }

    if (!socketRef.current?.isOpen()) {
      showToast("Нет соединения с чатом. Обновите страницу.", { type: "error" });
      setError("Нет соединения с чатом. Обновите страницу.");
      return;
    }

    setIsSending(true);
    try {
      socketRef.current.send(text);
      setMessageText("");
      setError("");
    } catch (requestError) {
      showToast(requestError.message || "Не удалось отправить сообщение", { type: "error" });
      setError(requestError.message || "Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  }

  const canShowThread = Boolean(selectedConversationId);

  function isIncomingMessage(message) {
    if (activeConversation?.other_user) {
      return message.sender_id === activeConversation.other_user.id;
    }
    if (currentUserId) {
      return message.sender_id !== currentUserId;
    }
    return false;
  }

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <BackButton fallback="/" />
      <section className="chat-page">
        <aside className="chat-sidebar">
          <h1>Чаты</h1>
          {isLoadingConversations ? <p className="chat-status">⏳ ...</p> : null}
          {!isLoadingConversations && conversations.length === 0 ? (
            <p className="chat-status">📭 Пусто</p>
          ) : null}
          <div className="chat-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`chat-list__item ${conversation.id === selectedConversationId ? "active" : ""}`}
                onClick={() => selectConversation(conversation.id)}
              >
                <p className="chat-list__name">{getFullName(conversation.other_user)}</p>
                <p className="chat-list__title">{conversation.listing_title}</p>
                <p className="chat-list__preview">{conversation.last_message_text ?? "✉️ Напишите"}</p>
                <div className="chat-list__meta">
                  <small>{formatTime(conversation.last_message_at || conversation.updated_at)}</small>
                  {conversation.unread_count > 0 ? <span>{conversation.unread_count}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-thread">
          {canShowThread ? (
            <>
              <header className="chat-thread__head">
                <h2>{activeConversation?.listing_title ?? listingContext?.title ?? "Чат по объявлению"}</h2>
                {activeConversation?.other_user ? (
                  <p>👤 {getFullName(activeConversation.other_user)}</p>
                ) : null}
              </header>
              <div className="chat-thread__messages">
                {isLoadingMessages ? <p className="chat-status">⏳ ...</p> : null}
                {!isLoadingMessages && messages.length === 0 ? (
                  <p className="chat-status">✉️ Напишите первым</p>
                ) : null}
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-bubble ${isIncomingMessage(message) ? "chat-bubble--incoming" : "chat-bubble--outgoing"}`}
                  >
                    <p>{message.text}</p>
                    <small>{formatTime(message.created_at)}</small>
                  </article>
                ))}
              </div>

              <form className="chat-thread__form" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="💬 Сообщение..."
                  maxLength={2000}
                  required
                />
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSending}
                  disabled={isSending || !messageText.trim() || !isSocketReady}
                  className="chat-thread__send"
                >
                  Отправить
                </Button>
              </form>
            </>
          ) : (
            <div className="chat-thread__empty">
              <p>👈 Выберите диалог</p>
            </div>
          )}
        </section>
      </section>
    </>
  );
}
