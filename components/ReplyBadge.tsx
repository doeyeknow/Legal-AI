/**
 * The unanswered-reply badge (see lib/reply-state for the rules):
 * an amber dot + "Awaiting reply", or a red dot + "Reply overdue"
 * when the response deadline has passed. Used on dashboard case
 * cards, in the case header, and beside individual comm entries.
 */
export default function ReplyBadge({ overdue }: { overdue: boolean }) {
  return (
    <span className={`replybadge${overdue ? ' overdue' : ''}`}>
      <span className="replydot" aria-hidden="true" />
      {overdue ? 'Reply overdue' : 'Awaiting reply'}
    </span>
  );
}
