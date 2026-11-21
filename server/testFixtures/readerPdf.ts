/** Small deterministic PDF fixture. No course material or student data is included. */
export function readerPdf(
  pages = [
    "Photosynthesis converts light energy into chemical energy.",
    "Mitochondria release energy through cellular respiration.",
  ]
) {
  const objects: Buffer[] = [];
  const add = (value: string) => objects.push(Buffer.from(value, "ascii"));
  add("<< /Type /Catalog /Pages 2 0 R >>");
  add(
    `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pages.forEach((text, i) => {
    add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`
    );
    const escaped = text.replace(/[\\()]/g, "\\$&");
    const stream = `BT /F1 14 Tf 50 700 Td (${escaped}) Tj ET`;
    add(
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
    );
  });
  const chunks = [Buffer.from("%PDF-1.4\n")];
  const offsets = [0];
  let length = chunks[0].length;
  objects.forEach((object, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    ]);
    chunks.push(chunk);
    length += chunk.length;
  });
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map(n => String(n).padStart(10, "0") + " 00000 n \n")
        .join(
          ""
        )}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`
    )
  );
  return Buffer.concat(chunks);
}
