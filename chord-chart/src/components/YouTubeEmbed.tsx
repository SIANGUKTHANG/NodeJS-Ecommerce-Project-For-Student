"use client";

type Props = {
  videoId: string;
};

export function YouTubeEmbed({ videoId }: Props) {
  return (
    <div className="yt-embed print-hide">
      <iframe
        title="YouTube song"
        src={`https://www.youtube.com/embed/${videoId}?rel=0`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
