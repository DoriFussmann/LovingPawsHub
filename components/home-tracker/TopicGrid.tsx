import TopicCard from "./TopicCard";

type Topic = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
  summary: string | null;
};

export default function TopicGrid({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) {
    return (
      <p className="text-sm font-light text-muted-foreground">No topics yet.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}
