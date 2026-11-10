const http = require("node:http");

const PORT = process.env.PORT || 10000;

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.url !== "/test-openai") {
    res.end(JSON.stringify({
      status: "ok",
      message: "Alice OpenAI Server работает"
    }));
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "API key not configured" }));
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      signal: AbortSignal.timeout(15000)
    });

    res.statusCode = response.status;

    res.end(JSON.stringify({
      openai_status: response.status,
      connected: response.ok
    }));
  } catch (error) {
    res.statusCode = 502;
    res.end(JSON.stringify({
      connected: false,
      error: error.message
    }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
