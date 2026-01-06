import Workspace from "@/components/workspace";
import { demoChallenge, demoTraces } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export default function DemoWorkspace() {
  return <Workspace challenge={demoChallenge} traces={demoTraces} />;
}
