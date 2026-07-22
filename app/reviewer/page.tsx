import { requireReviewer } from "../chatgpt-auth";
import ReviewerClient from "./reviewer-client";

export const dynamic = "force-dynamic";

export default async function ReviewerPage() {
  const user = await requireReviewer("/reviewer");
  return <ReviewerClient reviewerName={user.displayName} />;
}
