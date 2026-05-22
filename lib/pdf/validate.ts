import pdfParse from 'pdf-parse';

const MAX_PAGES = 100;
const MAX_BYTES = 50 * 1024 * 1024;

export async function validatePdf(buffer: Buffer): Promise<{ pageCount: number }> {
  if (buffer.length > MAX_BYTES) {
    throw new Error(
      `PDF exceeds 50 MB limit (${(buffer.length / 1024 / 1024).toFixed(1)} MB uploaded)`,
    );
  }
  const data = await pdfParse(buffer);
  if (data.numpages > MAX_PAGES) {
    throw new Error(
      `PDF has ${data.numpages} pages; maximum allowed is ${MAX_PAGES}`,
    );
  }
  return { pageCount: data.numpages };
}
