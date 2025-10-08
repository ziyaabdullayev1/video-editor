# Video Editor

A modern, web-based video editor built with Next.js that allows you to cut and trim video segments with precision.

## Features

- ✂️ **Timeline-based editing**: Select time ranges on the timeline and cut them out
- 🎬 **Live preview**: See changes in real-time while scrubbing
- 🔊 **Audio crossfade**: Smooth audio transitions between cuts
- 🔍 **Advanced zoom**: Zoom down to 10ms precision for accurate editing
- 📤 **Multiple video sources**: Upload files or load videos via URL
- 🎯 **Millisecond precision**: Show milliseconds when zoomed to 10s or less

## Getting Started

### Development

First, install dependencies and run the development server:

```bash
npm install
npm run dev
# or
yarn install && yarn dev
# or
pnpm install && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Loading Videos via URL

You can load videos directly from another application by passing a `path` query parameter:

```
http://localhost:3000/?path=/outputs/video.mp4
```

**Example from video recorder app:**
```
https://videocut.boencv.com/?path=/outputs/output_1759526107745.mp4_final_output.mp4
```

The `path` parameter should point to the video file path that your server can access.

### Nginx Configuration

If your video recorder application serves files from a different location or port, uncomment and configure the proxy settings in `nginx.conf`:

```nginx
location /outputs {
    proxy_pass http://recorder_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    add_header Access-Control-Allow-Origin *;
}

upstream recorder_upstream {
    server localhost:8080;  # Change to your recorder app's port
}
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
