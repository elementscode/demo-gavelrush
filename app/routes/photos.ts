import { Request, Response, sql } from "@elements/app";

interface Photo {
  contentType: string;
  hash: string;
  data: Buffer;
}

const INLINE = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);
const YEAR = 31536000;

/** Uploaded lot photos. The hash in the path makes them safe to cache forever. */
export default function servePhoto(req: Request, res: Response) {
  let photo = sql<Photo>(`
    select contentType, hash, data from lotPhotos
     where id = ${req.params.id} and data is not null
  `).firstOrThrow();

  if (req.params.hash !== photo.hash || !INLINE.has(photo.contentType)) {
    res.status(404);
    return res.end();
  }

  res.setHeader("Content-Type", photo.contentType);
  res.setHeader("Cache-Control", `public, max-age=${YEAR}, immutable`);

  return photo.data;
}
