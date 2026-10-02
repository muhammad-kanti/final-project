import { NextRequest } from "next/server";
import { getIncidents } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  let interval: NodeJS.Timeout;
  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const incidents = await getIncidents();
          const payload = `data: ${JSON.stringify({ incidents })}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        } catch (e) {
          const payload = `event: error\ndata: ${JSON.stringify({ error: "stream_error" })}\n\n`;
          controller.enqueue(new TextEncoder().encode(payload));
        }
      };
      await send();
      interval = setInterval(() => {
        send();
      }, 2000);
    },
    cancel() {
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
