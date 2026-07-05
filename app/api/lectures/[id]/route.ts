import { updateMedia, deleteMedia } from "../../../../lib/mediaCollection";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return updateMedia("lectures", id, req);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return deleteMedia("lectures", id);
}
