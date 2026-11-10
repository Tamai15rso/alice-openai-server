
const http = require("node:http");

const PORT = process.env.PORT || 10000;
const MODEL = "gpt-6-luna";

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // Проверка работы сервера
  if (req.method === "GET" && req.url === "/") {
    return send(res, 200, {
      status: "ok"
    });
  }

  // Разрешаем только запросы от Cloudflare
  if (req.method !== "POST" || req.url !== "/chat") {
    return send(res, 404, {
      error: "Not found"
    });
  }

  // Проверка секретного ключа между Cloudflare и Render
  if (
    !process.env.RELAY_SECRET ||
    req.headers["x-relay-secret"] !== process.env.RELAY_SECRET
  ) {
    return send(res, 401, {
      error: "Unauthorized"
    });
  }

  // Проверка ключа OpenAI
  if (!process.env.OPENAI_API_KEY) {
    return send(res, 500, {
      error: "OpenAI key missing"
    });
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 10000) {
        return send(res, 413, {
          error: "Request too large"
        });
      }
    }

    const { question } = JSON.parse(body);

    if (
      typeof question !== "string" ||
      !question.trim()
    ) {
      return send(res, 400, {
        error: "Question required"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "Ты умный голосовой собеседник в навыке Алисы. " +
                "Отвечай по-русски, естественно и понятно. " +
                "Избегай Markdown, списков и длинных вступлений. " +
                "Ответ должен быть удобен для произнесения вслух. " +
                "Старайся укладываться в 350 символов. " +
                "Если информации недостаточно или она " +
                "может быть устаревшей, честно скажи об этом. " +
                "Не придумывай сведения о своей версии."
            },
            {
              role: "user",
              content: question.trim().slice(0, 2000)
            }
          ],
          max_completion_tokens: 300
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "OPENAI ERROR:",
        response.status,
        data.error?.code || "",
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
        error: "Empty AI response",
        model: data.model || null
      });
    }

    return send(res, 200, {
      answer: answer.trim().slice(0, 350),
      model: data.model || null
    });

  } catch (error) {
    console.error("CHAT ERROR:", error.message);

    return send(res, 502, {
      error: "Chat unavailable"
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
