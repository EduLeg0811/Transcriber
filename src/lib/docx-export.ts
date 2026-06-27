import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export async function buildTranscriptDocx(opts: {
  title: string;
  text: string;
  sourceLabel?: string;
}): Promise<Blob> {
  const paragraphs = opts.text
    .split(/\n{2,}|\r\n\r\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 200, line: 320 },
          children: [new TextRun({ text: block, font: "Calibri", size: 24 })],
        }),
    );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 24 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 },
            children: [new TextRun({ text: opts.title, bold: true, size: 40, font: "Calibri" })],
          }),
          ...(opts.sourceLabel
            ? [
                new Paragraph({
                  spacing: { after: 400 },
                  children: [
                    new TextRun({
                      text: opts.sourceLabel,
                      italics: true,
                      color: "666666",
                      size: 20,
                      font: "Calibri",
                    }),
                  ],
                }),
              ]
            : []),
          ...paragraphs,
        ],
      },
    ],
  });

  const buf = await Packer.toBlob(doc);
  return buf;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
