import { NextRequest } from "next/server";
import { getCurrentUser, forbidden, unauthorized } from "@/lib/auth/dal";
import { getIncidents } from "@/lib/db";

export const runtime = "nodejs";

/** Admin-only live feed of every report. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "admin") return forbidden("Admin access required");

  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = async () => {
        try {
          const incidents = await getIncidents();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ incidents })}\n\n`));
        } catch {
          try {
            controller.enqueue(encoder.encode(`event: error\ndata: {"error":"stream_error"}\n\n`));
          } catch {
            // client already disconnected
          }
        }
      };

      await send();
      interval = setInterval(() => {
        if (req.signal.aborted) {
          if (interval) clearInterval(interval);
          return;
        }
        void send();
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