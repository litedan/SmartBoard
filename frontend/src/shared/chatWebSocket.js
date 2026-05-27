function getChatWsUrl(conversationId) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1/chat/conversations/${conversationId}/messages`;
}

export function createChatSocket(conversationId, handlers = {}) {
  const { onMessage, onError, onOpen, onClose } = handlers;
  const ws = new WebSocket(getChatWsUrl(conversationId));

  ws.onopen = () => {
    onOpen?.();
  };

  ws.onclose = () => {
    onClose?.();
  };

  ws.onerror = () => {
    onError?.("Ошибка соединения с чатом");
  };

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload?.type === "error") {
        onError?.(payload.message || "Ошибка чата");
        return;
      }
      if (payload?.type === "message" && payload.data) {
        onMessage?.(payload.data);
        return;
      }
      if (payload?.id && payload?.conversation_id) {
        onMessage?.(payload);
      }
    } catch {
      onError?.("Некорректный ответ сервера");
    }
  };

  return {
    send(text) {
      if (ws.readyState !== WebSocket.OPEN) {
        throw new Error("Нет соединения с чатом");
      }
      ws.send(JSON.stringify({ text: text.trim() }));
    },
    close() {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    isOpen() {
      return ws.readyState === WebSocket.OPEN;
    },
  };
}
