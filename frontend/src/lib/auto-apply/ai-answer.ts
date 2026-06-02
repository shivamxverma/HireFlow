import { GoogleGenAI } from "@google/genai";
import { UserProfileData } from "./mapping";

export async function generateAiAnswer(
  question: string, 
  profile: UserProfileData,
  resumeText: string = ""
): Promise<string> {
  // Support both GEMINI_API_KEY and GOOGLE_API_KEY
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.Google_api_key;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY / GOOGLE_API_KEY is not set. Using fallback answer.");
    return "I am very interested in this opportunity and believe my skills strongly align with the requirements.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
You are applying for a job on behalf of ${profile.fullName}.
Answer the following application question professionally and concisely (1-3 sentences maximum).

User Profile Info:
Role: Software Engineer
Location: ${profile.location}
Experience: 5 years

Question: "${question}"

Write the exact text that should be typed into the form input. Do not include quotes or conversational filler like "Here is the answer".
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text || "N/A";
  } catch (error) {
    console.error("AI Answer Engine Error:", error);
    return "I am highly adaptable and eager to bring my expertise to this role.";
  }
}
