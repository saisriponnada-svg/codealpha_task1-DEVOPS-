import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is not configured. Please define it in your Secrets / Env panel." 
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // System instruction for the Azure DevOps chatbot
      const systemInstruction = 
        "You are 'Azure DevOps Coach', an elite Cloud Solutions Architect specializing in Azure DevOps, CI/CD, Containerization, and Cloud App Deployments.\n\n" +
        "Your task is to assist the user in learning DevOps and understanding how to construct, troubleshoot, or deploy cloud-native containers in Azure.\n" +
        "Make your responses conversational, practical, elegant, and action-oriented. Support them in resolving the pipeline troubleshooting scenarios they encounter in this sandbox playground:\n" +
        "1. Failing unit tests\n" +
        "2. Service Connection credential expired\n" +
        "3. Multi-environment promotion gates (e.g., waiting for approvals in environment environment)\n" +
        "4. Dockerfile syntax or path error\n\n" +
        "Respond in well-structured Markdown, utilizing code tags, lists, or yaml code blocks (`yaml`). Encourage them to run the pipeline, investigate logs, or try modifying the pipeline YAML directly in the Sandbox.";

      // Restructure chat hist to match GoogleGenAI schema if needed
      // GoogleGenAI SDK contents: [{role: 'user'|'model', parts: [{text: ...}]}]
      const contents = history && Array.isArray(history) 
        ? history.map((item: any) => ({
            role: item.role === 'assistant' ? 'model' : item.role,
            parts: [{ text: item.content }]
          }))
        : [];
      
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: error.message || "An error occurred with the DevOps AI Assistant." });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
