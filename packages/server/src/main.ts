import { handleOpen, handleMessage, handleClose } from './ws';

const port = Number(process.env['LUNA_PORT'] ?? 8787);

const server = Bun.serve({
  port,
  fetch(req, srv) {
    if (srv.upgrade(req, { data: undefined })) return;
    return new Response('luna-server: WebSocket only', { status: 426 });
  },
  websocket: {
    open: handleOpen,
    message: handleMessage,
    close: handleClose,
  },
});

console.log(`[luna-server] listening on ws://${server.hostname}:${server.port}`);
