"use client";

import { Flex, Text } from "@radix-ui/themes";

interface RedditPost {
  time: string;
  author: string;
  snippet: string;
  sentiment: string;
}

interface SocialSentimentPanelProps {
  posts: RedditPost[];
  expanded: boolean;
  onClick: () => void;
}

export default function SocialSentimentPanel({ posts, expanded, onClick }: SocialSentimentPanelProps) {
  return (
    <div
      className="p-3 flex flex-col cursor-pointer"
      style={{ background: 'var(--slate-2)' }}
      onClick={onClick}
    >
      <Flex justify="between" align="center" className="mb-2">
        <Text size="1" weight="bold" className="uppercase tracking-wider" style={{ color: 'var(--slate-11)' }}>
          Social Sentiment
        </Text>
        <Text size="1" style={{ color: 'var(--slate-11)' }}>r/wallstreetbets</Text>
      </Flex>

      {!expanded ? (
        <div className="flex-1 flex flex-col justify-center">
          <Flex direction="column" gap="3">
            <div>
              <Text size="1" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Bullish/Bearish Ratio</Text>
              <Flex align="baseline" gap="2">
                <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>72</Text>
                <Text size="2" style={{ color: 'var(--slate-11)' }}>/</Text>
                <Text size="5" weight="bold" className="font-mono" style={{ color: 'var(--red-10)' }}>28</Text>
              </Flex>
            </div>
            <div>
              <Text size="1" className="mb-1 block" style={{ color: 'var(--slate-11)' }}>Sentiment Score</Text>
              <Text size="4" weight="bold" className="font-mono" style={{ color: 'var(--green-11)' }}>+44</Text>
            </div>
            <Text size="1" style={{ color: 'var(--slate-11)' }}>
              Click to view recent posts →
            </Text>
          </Flex>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
          {posts.map((post, idx) => (
            <div
              key={idx}
              className="p-2 border rounded"
              style={{ background: 'var(--slate-3)', borderColor: 'var(--slate-6)' }}
            >
              <Flex justify="between" className="mb-1">
                <Text size="1" weight="medium" style={{ color: 'var(--blue-11)' }}>{post.author}</Text>
                <Text size="1" style={{ color: 'var(--slate-11)' }}>{post.time}</Text>
              </Flex>
              <Text size="1" className="leading-relaxed" style={{ color: 'var(--slate-12)' }}>
                {post.snippet}
              </Text>
              <div className="mt-1">
                <span className={`text-xs px-1.5 py-0.5 rounded`} style={{
                  background: post.sentiment === 'bullish' ? 'var(--green-3)' : 'var(--red-4)',
                  color: post.sentiment === 'bullish' ? 'var(--green-11)' : 'var(--red-10)'
                }}>
                  {post.sentiment}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
