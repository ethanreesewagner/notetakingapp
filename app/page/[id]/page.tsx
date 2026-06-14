import WorkspaceShell from "../../../components/WorkspaceShell";
import PageRouteSync from "../../../components/PageRouteSync";

export default async function PageDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PageRouteSync pageId={id} />
      <WorkspaceShell />
    </>
  );
}
