
const http = require("node:http");

const PORT = process.env.PORT || 10000;
const MODEL = "gpt-6-luna";

const SYSTEM_PROMPT =
  "Ты продвинутый голосовой ИИ-помощник в навыке Алисы. " +
  "Разговаривай по-русски, естественно и понятно. " +
  "Твоя задача — поддерживать непрерывный диалог. " +
  "Учитывай предыдущие сообщения, старые воспоминания " +
  "и краткое содержание прошлых разговоров. " +
  "Помни обсуждаемые темы, имена, решения и предпочтения. " +
  "Если пользователь говорит 'он', 'она', 'это', " +
  "'тот вариант', 'продолжай' или 'почему', " +
  "опирайся на контекст разговора. " +
  "Если сведений недостаточно, уточняй, а не выдумывай. " +
  "Отвечай без Markdown, удобно для произнесения вслух. " +
  "Обычно отвечай кратко, до 350 символов. " +
  "Не утверждай, что знаешь свежие события без проверки.";

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    return send(res, 200, {
      status: "ok"
    });
  }

  if (req.method !== "POST" || req.url !== "/chat") {
    return send(res, 404, {
      error: "Not found"
    });
  }

  // Проверяем секрет между Cloudflare и Render
  if (
    !process.env.RELAY_SECRET ||
    req.headers["x-relay-secret"] !== process.env.RELAY_SECRET
  ) {
    return send(res, 401, {
      error: "Unauthorized"
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return send(res, 500, {
      error: "OpenAI key missing"
    });
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 100000) {
        return send(res, 413, {
          error: "Request too large"
        });
      }
    }

    let payload;

    try {
      payload = JSON.parse(body);
    } catch {
      return send(res, 400, {
        error: "Invalid JSON"
      });
    }

    const question =
      typeof payload.question === "string"
        ? payload.question.trim().slice(0, 2000)
        : "";

    if (!question) {
      return send(res, 400, {
        error: "Question required"
      });
    }

    const incomingMessages =
      Array.isArray(payload.messages)
        ? payload.messages
        : [];

    // Принимаем историю и системные блоки памяти
    const context = incomingMessages
      .filter(message =>
        message &&
        (
          message.role === "user" ||
          message.role === "assistant" ||
          message.role === "system"
        ) &&
        typeof message.content === "string" &&
        message.content.trim()
      )
      .slice(-45)
      .map(message => ({
        role: message.role,
        content: message.content.slice(0, 6000)
      }));

    // Убираем системный промпт Cloudflare,
    // чтобы не дублировать инструкции
    if (
      context.length > 0 &&
      context[0].role === "system"
    ) {
      context.shift();
    }

    // Не дублируем текущий вопрос
    if (
      context.length > 0 &&
      context[context.length - 1].role === "user" &&
      context[context.length - 1].content === question
    ) {
      context.pop();
    }

    const messages = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      ...context,
      {
        role: "user",
        content: question
      }
    ];

    console.log(
      "CONTEXT MESSAGES:",
      messages.length
    );

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_completion_tokens: 500
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OPENAI ERROR:",
        response.status,
        data.error?.message || ""
      );

      return send(res, 502, {
        error: "OpenAI request failed",
        status: response.status
      });
    }

    const answer =
      data.choices?.[0]?.message?.content;

    console.log("REQUESTED MODEL:", MODEL);
    console.log(
      "ACTUAL MODEL:",
      data.model || "unknown"
    );

    if (
      typeof answer !== "string" ||
      !answer.trim()
    ) {
      return send(res, 502, {
        error: "Empty AI response"
      });
    }

    return send(res, 200, {
      answer: answer.trim().slice(0, 350),
      model: data.model || null,
      context_messages: messages.length
    });

  } catch (error) {
    console.error(
      "CHAT ERROR:",
      error.message
    );

    return send(res, 502, {
      error: "Chat unavailable"
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    "Server started on port " + PORT
  );
});
