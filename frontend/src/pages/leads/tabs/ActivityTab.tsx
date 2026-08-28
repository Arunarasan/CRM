import FollowUpsTab from "./FollowUpsTab";
import CommunicationsTab from "./CommunicationsTab";
import NotesTab from "./NotesTab";

/**
 * Everything about *talking to the customer*, stacked into one tab: follow-up reminders, the
 * communication log, and free-form notes. Each sub-section keeps its own add/edit controls.
 */
export default function ActivityTab({
  leadId,
  onChanged,
}: {
  leadId: string;
  onChanged: () => void;
}) {
  return (
    <div className="space-y-6">
      <FollowUpsTab leadId={leadId} onChanged={onChanged} />
      <CommunicationsTab leadId={leadId} onChanged={onChanged} />
      <NotesTab leadId={leadId} />
    </div>
  );
}
