<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/124OWJZMlU8DGCA4zVv_K-CbXswk9NDb1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your API key:
   - Copy `.env.example` to `.env` (or create `.env` file)
   - Set `GEMINI_API_KEY` in `.env` file with your Gemini API key
   - Get your API key from: https://makersuite.google.com/app/apikey
   
   Example `.env` file:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. Run the app:
   ```bash
   npm run dev
   ```
