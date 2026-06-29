import ytdl from "@distube/ytdl-core";
import fs from "fs";

async function run() {
  const videoId = "XX1fnAeVe8A";
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("Fetching video info using ytdl-core...");
  try {
    const info = await ytdl.getInfo(url);
    console.log("Title:", info.videoDetails.title);
    
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    console.log("Selected format ITAG:", format.itag, "container:", format.container, "audioBitrate:", format.audioBitrate);
    
    console.log("Starting download...");
    const stream = ytdl.downloadFromInfo(info, { format });
    const writeStream = fs.createWriteStream("scratch/test_audio.mp3");
    stream.pipe(writeStream);
    
    writeStream.on("finish", () => {
      console.log("Finished download successfully!");
      const stats = fs.statSync("scratch/test_audio.mp3");
      console.log("File size:", stats.size, "bytes");
    });
    
    writeStream.on("error", (e) => {
      console.error("Write stream error:", e);
    });
  } catch (e) {
    console.error("ytdl-core error:", e);
  }
}

run();
