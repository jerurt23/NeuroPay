import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { ClaveIncorrecta, ClaveRequerida, type ItemPdf } from './estadoCuenta.ts';

let listo = false;

/**
 * Lee el texto de cada página del PDF con la posición de cada palabra.
 * Corre solo en el navegador: el archivo no sale del dispositivo.
 * La contraseña se usa para abrir el archivo y no se guarda.
 */
export async function leerItemsPdf(archivo: File, clave?: string): Promise<ItemPdf[][]> {
  if (!listo) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    listo = true;
  }

  const data = new Uint8Array(await archivo.arrayBuffer());
  const tarea = pdfjs.getDocument({ data, password: clave });
  let documento: pdfjs.PDFDocumentProxy;
  try {
    documento = await tarea.promise;
  } catch (e) {
    const codigo = (e as { code?: number }).code;
    if (codigo === pdfjs.PasswordResponses.NEED_PASSWORD) throw new ClaveRequerida();
    if (codigo === pdfjs.PasswordResponses.INCORRECT_PASSWORD) throw new ClaveIncorrecta();
    throw e;
  }

  const paginas: ItemPdf[][] = [];
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n);
    const { items } = await pagina.getTextContent();
    paginas.push(
      items.flatMap((it) =>
        'str' in it && it.str.trim()
          ? [{ x: it.transform[4], y: it.transform[5], ancho: it.width, s: it.str.trim() }]
          : []
      )
    );
  }
  await tarea.destroy();
  return paginas;
}
