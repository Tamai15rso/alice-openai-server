
const http = require("node:http");

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "GET" && req.url === "/") {
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method !== "POST" || req.url !== "/chat") {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const secret = process.env.RELAY_SECRET;

  if (!secret || req.headers["x-relay-secret"] !== secret) {
    res.statusCode = 401;
    res.end(JSON.stringify({ error: "Unauthorized" }));
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
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content:
                "Ты голосовой собеседник в навыке Алисы. " +
                "Отвечай по-русски, естественно, кратко, " +
                "без Markdown, максимум 350 символов."
            },
            {
              role: "user",
              content: question.slice(0, 2000)
            }
          ],
          reasoning_effort: "minimal",
          max_completion_tokens: 200
        }),
        signal: AbortSignal.timeout(20000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        error: "OpenAI request failed",
        status: response.status
      }));
      return;
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer?.trim()) {
      res.statusCode = 502;
      res.end(JSON.stringify({ error: "Empty AI response" }));
      return;
    }

    res.end(JSON.stringify({
      answer: answer.trim().slice(0, 350)
    }));

  } catch (error) {
    console.error("Chat error:", error.message);
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "Chat unavailable" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
