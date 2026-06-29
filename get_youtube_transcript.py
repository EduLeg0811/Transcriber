import sys
import json

# Force UTF-8 output encoding on Windows to prevent mojibakes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print(json.dumps({"error": "youtube-transcript-api is not installed. Run 'pip install youtube-transcript-api'."}))
    sys.exit(1)

def format_time(seconds):
    m = int(seconds // 60)
    s = int(seconds % 60)
    return f"{m:02d}:{s:02d}"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing video ID"}))
        sys.exit(1)
    
    video_id = sys.argv[1]
    try:
        api = YouTubeTranscriptApi()
        res_list = api.list(video_id)
        
        # Try finding Portuguese transcripts first, fall back to whatever is available
        try:
            t = res_list.find_transcript(['pt', 'pt-BR'])
        except Exception:
            try:
                # Fallback to English or Spanish
                t = res_list.find_transcript(['en', 'es'])
            except Exception:
                # Last resort: first available
                t = next(iter(res_list))
        
        data = t.fetch()
        
        segments = []
        formatted_lines = []
        
        for segment in data:
            # Extract properties depending on type
            if hasattr(segment, 'text'):
                text = segment.text
                start = segment.start
                duration = segment.duration
            elif isinstance(segment, dict):
                text = segment.get('text', '')
                start = segment.get('start', 0)
                duration = segment.get('duration', 0)
            else:
                text = str(segment)
                start = 0
                duration = 0
                
            end = start + duration
            segments.append({
                "start": start,
                "end": end,
                "text": text
            })
            
            timestamp_str = format_time(start)
            formatted_lines.append(f"[{timestamp_str}] {text}")
            
        full_text = "\n".join(formatted_lines)
        
        result = {
            "text": full_text,
            "segments": segments
        }
        
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
