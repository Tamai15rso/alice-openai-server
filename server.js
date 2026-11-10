
const http = require("node:http");

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8"
  });

  res.end(JSON.stringify({
    status: "ok",
    message: "Alice OpenAI Server работает"
  }));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
