import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

  // API Route: Test Circle API
  app.get("/api/circle/test", async (req, res) => {
    try {
      const apiKey = process.env.CIRCLE_API_KEY || "TEST_API_KEY:c705edc02dbdaa34f03fa3900056fa4b:b95f61aef0e255cf86a8c71fe41f2d81"; // Fallback to provided key for convenience
      
      const response = await fetch("https://api.circle.com/v1/w3s/wallets", {
        method: "GET",
        headers: {
          "accept": "application/json",
          "authorization": `Bearer ${apiKey}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      
      return res.json({ success: true, data });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // For Express 4
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
