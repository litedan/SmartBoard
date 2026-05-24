import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { ApiError } from "../../shared/api/client";
import {
  createConversationByListing,
  fetchConversationMessages,
  fetchConversations,
  markConversationRead,
  sendMessage,
} from "../../shared/api/chat";
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

export function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listingIdFromQuery = Number(searchParams.get("listingId") || "");

  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const breadcrumbs = useMemo(() => {
    const items = [{ label: "Каталог", to: "/" }, { label: "Чаты" }];
    if (selectedConversation) {
      items.push({ label: selectedConversation.listing_title });
    }
    return items;
  }, [selectedConversation]);

  const loadConversations = useCallback(async () => {
    try {
      const payload = await fetchConversations();
      const nextConversations = payload?.items ?? [];
      setConversations(nextConversations);
      setError("");
      setSelectedConversationId((prev) => {
        if (prev && nextConversations.some((item) => item.id === prev)) {
          return prev;
        }
        return nextConversations[0]?.id ?? null;
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить чаты");
    } finally {
      setIsLoadingConversations(false);
    }
  }, [navigate]);

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
        setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить сообщения");
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [navigate],
  );

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (Number.isInteger(listingIdFromQuery) && listingIdFromQuery > 0) {
        try {
          const conversation = await createConversationByListing(listingIdFromQuery);
          if (!mounted) {
            return;
          }
          setSelectedConversationId(conversation.id);
        } catch (requestError) {
          if (!mounted) {
            return;
          }
          if (requestError instanceof ApiError && requestError.status === 401) {
            navigate("/login", { replace: true });
            return;
          }
          setError(requestError instanceof ApiError ? requestError.message : "Не удалось открыть чат");
        }
      }
      if (mounted) {
        await loadConversations();
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [listingIdFromQuery, loadConversations, navigate]);

  useEffect(() => {
    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (selectedConversationId) {
        loadMessages(selectedConversationId);
      }
      loadConversations();
    }, 8000);

    return () => clearInterval(intervalId);
  }, [loadConversations, loadMessages, selectedConversationId]);

  async function handleSendMessage(event) {
    event.preventDefault();
    const text = messageText.trim();
    if (!text || !selectedConversationId) {
      return;
    }

    setIsSending(true);
    try {
      await sendMessage(selectedConversationId, text);
      setMessageText("");
      await loadMessages(selectedConversationId);
      await loadConversations();
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось отправить сообщение");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <section className="chat-page">
        <aside className="chat-sidebar">
          <h1>Чаты</h1>
          {isLoadingConversations ? <p className="chat-status">Загружаем диалоги...</p> : null}
          {!isLoadingConversations && conversations.length === 0 ? (
            <p className="chat-status">У вас пока нет диалогов.</p>
          ) : null}
          <div className="chat-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className={`chat-list__item ${conversation.id === selectedConversationId ? "active" : ""}`}
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <p className="chat-list__name">{getFullName(conversation.other_user)}</p>
                <p className="chat-list__title">{conversation.listing_title}</p>
                <p className="chat-list__preview">{conversation.last_message_text ?? "Начните диалог"}</p>
                <div className="chat-list__meta">
                  <small>{formatTime(conversation.last_message_at || conversation.updated_at)}</small>
                  {conversation.unread_count > 0 ? <span>{conversation.unread_count}</span> : null}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-thread">
          {selectedConversation ? (
            <>
              <header className="chat-thread__head">
                <h2>{selectedConversation.listing_title}</h2>
                <p>{getFullName(selectedConversation.other_user)}</p>
              </header>
              <div className="chat-thread__messages">
                {isLoadingMessages ? <p className="chat-status">Загружаем сообщения...</p> : null}
                {!isLoadingMessages && messages.length === 0 ? (
                  <p className="chat-status">Пока нет сообщений. Напишите первым.</p>
                ) : null}
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`chat-bubble ${
                      message.sender_id === selectedConversation.other_user.id ? "chat-bubble--incoming" : "chat-bubble--outgoing"
                    }`}
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
                  placeholder="Введите сообщение"
                  maxLength={2000}
                  required
                />
                <button type="submit" disabled={isSending || !messageText.trim()}>
                  {isSending ? "Отправляем..." : "Отправить"}
                </button>
              </form>
            </>
          ) : (
            <div className="chat-thread__empty">
              <p>Выберите диалог слева, чтобы начать общение.</p>
            </div>
          )}
        </section>
      </section>
      {error ? <p className="chat-global-error">{error}</p> : null}
    </>
  );
}
