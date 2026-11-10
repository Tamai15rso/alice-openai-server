
const http = require("node:http");

const PORT = process.env.PORT || 10000;
const MODEL = "gpt-6-luna";

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && req.url === "/") {
    res.end(JSON.stringify({
      status: "ok",
      server: "Alice OpenAI Server"
    }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/chat") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  if (
    !process.env.RELAY_SECRET ||
    req.headers["x-relay-secret"] !== process.env.RELAY_SECRET
  ) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "OpenAI key missing" }));
    return;
  }

  try {
    let body = "";

    for await (const chunk of req) {
      body += chunk;

      if (body.length > 10000) {
        res.statusCode = 413;
        res.end(JSON.stringify({ error: "Request too large" }));
        return;
      }
    }

    const { question } = JSON.parse(body);

    if (typeof question !== "string" || !question.trim()) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Question required" }));
      return;
    }

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "Ты голосовой собеседник в навыке Алисы. " +
                "Твоя модель — GPT-6 Luna от OpenAI. " +
                "Если спрашивают о версии, отвечай: GPT-6 Luna. " +
                "Не выдумывай дату окончания знаний. " +
                "Отвечай по-русски, естественно, " +
                "кратко, без Markdown, до 350 символов."
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

      res.statusCode = 502;
      res.end(JSON.stringify({
        error: "OpenAI request failed",
        status: response.status
      }));
      return;
    }

    const answer = data.choices?.[0]?.message?.content;

    console.log("REQUESTED MODEL:", MODEL);
    console.log("ACTUAL MODEL:", data.model || "unknown");

    if (!answer?.trim()) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        error: "Empty AI response",
        model: data.model || null
      }));
      return;
    }

    res.end(JSON.stringify({
      answer: answer.trim().slice(0, 350),
      model: data.model || null
    }));

  } catch (error) {
    console.error("CHAT ERROR:", error.message);

    res.statusCode = 502;
    res.end(JSON.stringify({
      error: "Chat unavailable"
    }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
