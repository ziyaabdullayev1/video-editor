import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const execAsync = promisify(exec);

interface Cut {
  s: number; // start time in seconds
  e: number; // end time in seconds
}

interface ExportRequest {
  videoUrl: string;
  cuts: Cut[];
}

// Download video from URL
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = require('fs').createWriteStream(outputPath);
    
    protocol.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      require('fs').unlink(outputPath, () => {});
      reject(err);
    });
  });
}

// Generate FFmpeg filter for cuts
function generateFFmpegFilter(cuts: Cut[], duration: number): string {
  if (cuts.length === 0) {
    return '';
  }

  // Sort cuts by start time
  const sortedCuts = [...cuts].sort((a, b) => a.s - b.s);
  
  // Build segments (parts to keep)
  const segments: { start: number; end: number }[] = [];
  let lastEnd = 0;

  for (const cut of sortedCuts) {
    if (cut.s > lastEnd) {
      segments.push({ start: lastEnd, end: cut.s });
    }
    lastEnd = Math.max(lastEnd, cut.e);
  }

  // Add final segment if there's content after last cut
  if (lastEnd < duration) {
    segments.push({ start: lastEnd, end: duration });
  }

  // Generate complex filter
  const selectFilters = segments.map((seg, i) => 
    `[0:v]trim=start=${seg.start}:end=${seg.end},setpts=PTS-STARTPTS[v${i}];` +
    `[0:a]atrim=start=${seg.start}:end=${seg.end},asetpts=PTS-STARTPTS[a${i}]`
  ).join(';');

  const concatInputs = segments.map((_, i) => `[v${i}][a${i}]`).join('');
  const concatFilter = `${concatInputs}concat=n=${segments.length}:v=1:a=1[outv][outa]`;

  return `${selectFilters};${concatFilter}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { videoUrl, cuts } = body;

    console.log('🎬 Export request received:', {
      videoUrl: videoUrl.substring(0, 50) + '...',
      cutsCount: cuts.length
    });

    // Validate input
    if (!videoUrl || !Array.isArray(cuts)) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    // Create temp and output directories
    const tempDir = path.join(process.cwd(), 'temp');
    const outputDir = path.join(process.cwd(), 'public', 'exports');
    
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }
    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const inputPath = path.join(tempDir, `input_${timestamp}.mp4`);
    const outputFilename = `edited_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    try {
      // Download video
      console.log('📥 Downloading video from:', videoUrl);
      await downloadVideo(videoUrl, inputPath);
      console.log('✅ Video downloaded');

      // Get video duration
      const { stdout: probeOutput } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`
      );
      const duration = parseFloat(probeOutput.trim());
      console.log('⏱️ Video duration:', duration);

      if (cuts.length === 0) {
        // No cuts, just copy the file
        console.log('📋 No cuts, copying original video');
        await execAsync(`cp "${inputPath}" "${outputPath}"`);
      } else {
        // Apply cuts using FFmpeg
        const filter = generateFFmpegFilter(cuts, duration);
        console.log('🎬 Applying cuts with FFmpeg filter');
        
        const ffmpegCommand = `ffmpeg -i "${inputPath}" -filter_complex "${filter}" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k "${outputPath}"`;
        
        console.log('🔧 FFmpeg command:', ffmpegCommand);
        await execAsync(ffmpegCommand);
      }

      console.log('✅ Video exported successfully');

      // Clean up temp file
      await unlink(inputPath);

      // Return download URL
      return NextResponse.json({
        success: true,
        downloadUrl: `/exports/${outputFilename}`,
        filename: outputFilename
      });

    } catch (error: any) {
      console.error('❌ Export error:', error);
      
      // Clean up on error
      if (existsSync(inputPath)) {
        await unlink(inputPath).catch(() => {});
      }
      if (existsSync(outputPath)) {
        await unlink(outputPath).catch(() => {});
      }

      throw error;
    }

  } catch (error: any) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Export failed', message: error.message },
      { status: 500 }
    );
  }
}

