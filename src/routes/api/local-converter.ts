import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/local-converter")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hostname = new URL(request.url).hostname;
        const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
        if (!isLocal || !!process.env.RENDER) {
          return Response.json(
            { ok: false, reason: "O conversor automático só está disponível localmente." },
            { status: 403 },
          );
        }

        const encodedName = request.headers.get("x-file-name");
        if (!encodedName || !request.body) {
          return Response.json({ ok: false, reason: "Arquivo não recebido." }, { status: 400 });
        }

        try {
          const fs = await import("node:fs");
          const path = await import("node:path");
          const stream = await import("node:stream");
          const streamPromises = await import("node:stream/promises");
          const childProcess = await import("node:child_process");

          const fileName = path.basename(decodeURIComponent(encodedName));
          const outputDir = path.join(
            process.cwd(),
            "converted",
            `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]+/g, "-")}`,
          );
          const inputPath = path.join(outputDir, fileName);
          const scriptPath = path.join(process.cwd(), "convert_split.py");

          await fs.promises.mkdir(outputDir, { recursive: true });
          await streamPromises.pipeline(
            stream.Readable.fromWeb(request.body as never),
            fs.createWriteStream(inputPath),
          );

          const quotePowerShell = (value: string) => `'${value.replace(/'/g, "''")}'`;
          const command = `& python ${quotePowerShell(scriptPath)} ${quotePowerShell(inputPath)}`;
          const converter = childProcess.spawn("powershell.exe", ["-NoExit", "-Command", command], {
            cwd: outputDir,
            detached: true,
            stdio: "ignore",
            windowsHide: false,
          });
          converter.unref();

          return Response.json({ ok: true, outputDir });
        } catch (error) {
          return Response.json(
            { ok: false, reason: error instanceof Error ? error.message : String(error) },
            { status: 500 },
          );
        }
      },
    },
  },
});
