import { listMedia, createMedia } from "../../../lib/mediaCollection";

export const dynamic = "force-dynamic";

export async function GET() {
  return listMedia("lectures");
}

export async function POST(req: Request) {
  return createMedia("lectures", req, "Lecture", "My Lecture");
}
