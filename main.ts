import { serveDir } from "https://deno.land/std@0.224.0/http/file_server.ts";

const encoder = new TextEncoder();
const MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 1 MB

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function isWebSocketRequest(req: Request) {
  return req.headers.get("upgrade")?.toLowerCase() === "websocket";
}

// Прокси для WebSocket
async function handleWebSocketProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathParts = url.pathname.replace("/tg/wss/", "").split("/");

  if (pathParts.length < 2) {
    return new Response("Invalid path", { status: 400 });
  }

  const dcWithSuffix = pathParts[0];
  const remotePath = pathParts.slice(1).join("/");
  const targetWsUrl = `wss://kws${dcWithSuffix}.web.telegram.org/${remotePath}`;
  log(`Connecting to Telegram WS: ${targetWsUrl}`);

  // 1. Подключаемся к Telegram
  const remote = new WebSocket(targetWsUrl, ["binary"]);
  remote.binaryType = "arraybuffer";

  await new Promise<void>((resolve, reject) => {
    remote.onopen = () => {
      log(`Connected to Telegram`);
      resolve();
    };
    remote.onerror = (e) => {
      reject(`Failed to connect to Telegram WS: ${e}`);
    };
  });

  // 2. Теперь апгрейдим клиентский запрос
  try {
    const { socket: client, response } = Deno.upgradeWebSocket(req, {
      protocol: "binary",
    });
        // 3. Настраиваем прокси между клиентом и Telegram
    client.binaryType = "arraybuffer";

    client.onopen = () => {
      log("Client WS connected");
    };

    client.onmessage = (e) => {
      const size = e.data?.byteLength ?? 0;
      if (size > MAX_MESSAGE_SIZE) {
        log(`Client sent too large message: ${size} bytes`);
        client.close(1009, "Message too big");
        return;
      }
      if (remote.readyState === WebSocket.OPEN) {
        remote.send(e.data);
      }
    };

    remote.onmessage = (e) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(e.data);
      }
    };

    remote.onclose = (e) => {
      log(`Remote WS closed: code=${e.code}, reason=${e.reason}`);
      client.close();
    };

    client.onclose = (e) => {
      log(`Client WS closed: code=${e.code}, reason=${e.reason}`);
      remote.close();
    };

    remote.onerror = (e) => {
      log(`Remote WS error: ${JSON.stringify(e)}`);
      client.close();
    };

    return response;
  } catch (e) {
    log(`Failed to upgrade client WS: ${e}`);
    return new Response("WebSocket upgrade failed", { status: 400 });
  }
}
  

// HTTP прокси
async function handleHttpProxy(req: Request): Promise<Response> {
  const url = new URL(req.url);
  
  // Извлекаем из пути префикс, который будет определять нужный DC (data center)
  const pathParts = url.pathname.replace("/tg/http/", "").split("/");

  if (pathParts.length < 2) {
    log(`Invalid path received: ${url.pathname}`);
    return new Response("Invalid path", { status: 400 });
  }

  const dcWithSuffix = pathParts[0]; // Это будет что-то вроде "1", "2", "3" (в зависимости от DC)
  const remotePath = pathParts.slice(1).join("/"); // Оставшаяся часть пути, например "apiws"

  log(`Received HTTP request for path: ${url.pathname}`);

  // Формируем новый URL с использованием правильного DC
  const targetUrl = `https://${dcWithSuffix}.web.telegram.org/${remotePath}`;
  log(`Proxying request to: ${targetUrl}`);

  // Прокси для HTTP-запроса
  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      redirect: "follow",
    });

    log(`Request to ${targetUrl} completed with status: ${response.status}`);
    return response;
  } catch (error) {
    log(`Error while proxying request to ${targetUrl}: ${error.message}`);
    return new Response("Error in proxy", { status: 500 });
  }
}

// Healthcheck
function handleHealth(): Response {
  return new Response("ok", { status: 200 });
}

Deno.serve({ port: 8765 }, async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/tg/wss") && isWebSocketRequest(req)) {
    return handleWebSocketProxy(req);
  }

  if (pathname.startsWith("/tg/http")) {
    return handleHttpProxy(req);
  }

  if (pathname === "/healthz") {
    return handleHealth();
  }

  if (pathname.startsWith("/tg")) {
    return serveDir(req, {
      fsRoot: "tg",
      urlRoot: "tg",
    });
  }

  return new Response("Not found", { status: 404 });
});
