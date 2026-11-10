
const http = require("node:http");

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url === "/") {
    res.end(JSON.stringify({
      status: "ok",
      message: "Alice OpenAI Server работает"
    }));
    return;
  }

  if (req.url === "/test-openai") {
    if (!process.env.OPENAI_API_KEY) {
      res.statusCode = 500;
      res.end(JSON.stringify({
        error: "OPENAI_API_KEY не настроен"
      }));
      return;
    }

    try {
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
                role: "user",
                content: "Ответь одним словом: привет"
              }
            ],
            reasoning_effort: "minimal",
            max_completion_tokens: 150
          }),
          signal: AbortSignal.timeout(25000)
        }
      );

      const data = await response.json();

      res.statusCode = response.status;

      res.end(JSON.stringify({
        openai_status: response.status,
        connected: response.ok,
        answer: data.choices?.[0]?.message?.content || null,
        error: response.ok ? undefined : data.error?.message
      }));
    } catch (error) {
      res.statusCode = 502;
      res.end(JSON.stringify({
        connected: false,
        error: error.message
      }));
    }

    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
